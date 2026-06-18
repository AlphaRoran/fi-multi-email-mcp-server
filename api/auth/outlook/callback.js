import { createBrokerCallbackEnvelope, parseBrokerSessionState } from "../../../src/brokerProtocol.js";
import { graphFetch } from "../../../src/oauth.js";
const outlookScopes = ["offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"];
export default async function handler(req, res) {
    try {
        const code = queryString(req.query.code, "code");
        const state = parseBrokerSessionState(queryString(req.query.state, "state"), process.env.EMAIL_MCP_BROKER_SHARED_SECRET);
        const tenant = process.env.MICROSOFT_TENANT_ID || "common";
        const params = new URLSearchParams({
            client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
            code,
            redirect_uri: `${publicBaseUrl()}/auth/outlook/callback`,
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
        const tokens = (await response.json());
        if (!response.ok) {
            throw new Error(`Microsoft token exchange failed: ${JSON.stringify(tokens)}`);
        }
        const profile = await graphFetch("/me", String(tokens.access_token));
        const email = profile.mail || profile.userPrincipalName;
        if (!email) {
            throw new Error("Microsoft Graph profile did not include an email address");
        }
        const envelope = createBrokerCallbackEnvelope({
            provider: "outlook",
            email,
            displayName: profile.displayName,
            scopes: outlookScopes,
            tokens
        }, signingOptions());
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.send(callbackRelayHtml(state.localCallbackUrl, envelope));
    }
    catch (error) {
        res.status(500).send(`OAuth broker failed: ${error.message}`);
    }
}
function signingOptions() {
    return {
        sharedSecret: process.env.EMAIL_MCP_BROKER_SHARED_SECRET,
        privateKeyPem: process.env.BROKER_PRIVATE_KEY?.replaceAll("\\n", "\n")
    };
}
function publicBaseUrl() {
    return requiredEnv("BROKER_PUBLIC_BASE_URL").replace(/\/$/, "");
}
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}
function queryString(value, name) {
    if (Array.isArray(value)) {
        return value[0] || "";
    }
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}
function callbackRelayHtml(localCallbackUrl, envelope) {
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
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        };
        return entities[char];
    });
}
