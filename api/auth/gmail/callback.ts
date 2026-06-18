import { google } from "googleapis";
import { createBrokerCallbackEnvelope, parseBrokerSessionState } from "../../../src/brokerProtocol.js";

const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email"
];

export default async function handler(
  req: { query: { code?: string | string[]; state?: string | string[] } },
  res: { status: (code: number) => { send: (body: string) => void }; setHeader: (name: string, value: string) => void; send: (body: string) => void }
) {
  try {
    const code = queryString(req.query.code, "code");
    const state = parseBrokerSessionState(queryString(req.query.state, "state"), process.env.EMAIL_MCP_BROKER_SHARED_SECRET);
    const client = new google.auth.OAuth2(
      requiredEnv("GOOGLE_CLIENT_ID"),
      requiredEnv("GOOGLE_CLIENT_SECRET"),
      `${publicBaseUrl()}/auth/gmail/callback`
    );
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
      signingOptions()
    );
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.send(callbackRelayHtml(state.localCallbackUrl, envelope));
  } catch (error) {
    res.status(500).send(`OAuth broker failed: ${(error as Error).message}`);
  }
}

function signingOptions() {
  return {
    sharedSecret: process.env.EMAIL_MCP_BROKER_SHARED_SECRET,
    privateKeyPem: process.env.BROKER_PRIVATE_KEY?.replaceAll("\\n", "\n")
  };
}

function publicBaseUrl(): string {
  return requiredEnv("BROKER_PUBLIC_BASE_URL").replace(/\/$/, "");
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function queryString(value: string | string[] | undefined, name: string): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function callbackRelayHtml(localCallbackUrl: string, envelope: unknown): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Connecting email account...</title></head>
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
