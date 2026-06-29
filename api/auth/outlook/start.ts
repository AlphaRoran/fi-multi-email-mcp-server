import { parseBrokerSessionState } from "../../../src/brokerProtocol.js";

const outlookScopes = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"];

export default function handler(
  req: { query: { state?: string | string[] } },
  res: { redirect: (url: string) => void; status: (code: number) => { send: (body: string) => void } }
) {
  try {
    const state = queryString(req.query.state, "state");
    parseBrokerSessionState(state, process.env.EMAIL_MCP_BROKER_SHARED_SECRET);
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const params = new URLSearchParams({
      client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
      response_type: "code",
      redirect_uri: `${publicBaseUrl()}/auth/outlook/callback`,
      response_mode: "query",
      scope: outlookScopes.join(" "),
      state
    });
    res.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`);
  } catch (error) {
    res.status(500).send(`OAuth broker failed: ${(error as Error).message}`);
  }
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
