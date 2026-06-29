import "dotenv/config";
import express from "express";
import { google } from "googleapis";
import { createBrokerCallbackEnvelope, parseBrokerSessionState } from "./brokerProtocol.js";
import { graphFetch } from "./oauth.js";

const brokerPort = Number(process.env.BROKER_PORT || "8787");
const publicBaseUrl = requiredEnv("BROKER_PUBLIC_BASE_URL").replace(/\/$/, "");
const sharedSecret = process.env.EMAIL_MCP_BROKER_SHARED_SECRET;
const privateKeyPem = process.env.BROKER_PRIVATE_KEY?.replaceAll("\\n", "\n");
if (!sharedSecret && !privateKeyPem) {
  throw new Error("BROKER_PRIVATE_KEY or EMAIL_MCP_BROKER_SHARED_SECRET is required");
}

const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email"
];

const outlookScopes = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"];

const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/auth/gmail/start", (req, res, next) => {
  try {
    const state = requireString(req.query.state, "state");
    parseBrokerSessionState(state, sharedSecret);
    const client = googleOAuthClient();
    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: gmailScopes,
      state
    });
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

app.get("/auth/gmail/callback", async (req, res, next) => {
  try {
    const code = requireString(req.query.code, "code");
    const state = parseBrokerSessionState(requireString(req.query.state, "state"), sharedSecret);
    const client = googleOAuthClient();
    const tokenResponse = await client.getToken(code);
    client.setCredentials(tokenResponse.tokens);

    const gmail = google.gmail({ version: "v1", auth: client as never });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress;
    if (!email) {
      throw new Error("Gmail profile did not include an email address");
    }

    const envelope = createBrokerCallbackEnvelope(
      {
        provider: "gmail",
        email,
        scopes: gmailScopes,
        tokens: tokenResponse.tokens as Record<string, unknown>
      },
      { sharedSecret, privateKeyPem }
    );
    res.type("html").send(callbackRelayHtml(state.localCallbackUrl, envelope));
  } catch (error) {
    next(error);
  }
});

app.get("/auth/outlook/start", (req, res, next) => {
  try {
    const state = requireString(req.query.state, "state");
    parseBrokerSessionState(state, sharedSecret);
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const params = new URLSearchParams({
      client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
      response_type: "code",
      redirect_uri: `${publicBaseUrl}/auth/outlook/callback`,
      response_mode: "query",
      scope: outlookScopes.join(" "),
      state
    });
    res.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`);
  } catch (error) {
    next(error);
  }
});

app.get("/auth/outlook/callback", async (req, res, next) => {
  try {
    const code = requireString(req.query.code, "code");
    const state = parseBrokerSessionState(requireString(req.query.state, "state"), sharedSecret);
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const params = new URLSearchParams({
      client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
      code,
      redirect_uri: `${publicBaseUrl}/auth/outlook/callback`,
      grant_type: "authorization_code",
      scope: outlookScopes.join(" ")
    });
    if (process.env.MICROSOFT_CLIENT_SECRET) {
      params.set("client_secret", process.env.MICROSOFT_CLIENT_SECRET);
    }

    const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params
    });
    const tokens = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(`Microsoft token exchange failed: ${JSON.stringify(tokens)}`);
    }

    const profile = await graphFetch<{ mail?: string; userPrincipalName?: string; displayName?: string }>(
      "/me",
      String(tokens.access_token)
    );
    const email = profile.mail || profile.userPrincipalName;
    if (!email) {
      throw new Error("Microsoft Graph profile did not include an email address");
    }

    const envelope = createBrokerCallbackEnvelope(
      {
        provider: "outlook",
        email,
        displayName: profile.displayName,
        scopes: outlookScopes,
        tokens
      },
      { sharedSecret, privateKeyPem }
    );
    res.type("html").send(callbackRelayHtml(state.localCallbackUrl, envelope));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).type("text").send(`OAuth broker failed: ${(error as Error).message}`);
});

app.listen(brokerPort, () => {
  console.log(`OAuth broker listening on ${brokerPort}`);
});

function googleOAuthClient() {
  return new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    `${publicBaseUrl}/auth/gmail/callback`
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function callbackRelayHtml(localCallbackUrl: string, envelope: unknown): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Connecting email account...</title>
  </head>
  <body>
    <h1>Connecting email account...</h1>
    <p>This window will finish the local MCP connection.</p>
    <form method="post" action="${escapeHtml(localCallbackUrl)}">
      <input type="hidden" name="envelope" value="${escapeHtml(JSON.stringify(envelope))}">
      <button type="submit">Continue</button>
    </form>
    <script>document.forms[0].submit();</script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };
    return entities[char];
  });
}
