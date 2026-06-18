import { google } from "googleapis";
import { parseBrokerSessionState } from "../../../src/brokerProtocol.js";

const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email"
];

export default function handler(
  req: { query: { state?: string | string[] } },
  res: { redirect: (url: string) => void; status: (code: number) => { send: (body: string) => void } }
) {
  try {
    const state = queryString(req.query.state, "state");
    parseBrokerSessionState(state, process.env.EMAIL_MCP_BROKER_SHARED_SECRET);
    const client = new google.auth.OAuth2(
      requiredEnv("GOOGLE_CLIENT_ID"),
      requiredEnv("GOOGLE_CLIENT_SECRET"),
      `${publicBaseUrl()}/auth/gmail/callback`
    );
    res.redirect(
      client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: gmailScopes,
        state
      })
    );
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
