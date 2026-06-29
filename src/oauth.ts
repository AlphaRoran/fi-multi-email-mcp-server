import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { google } from "googleapis";
import {
  createBrokerSessionState,
  verifyBrokerCallbackEnvelope,
  type BrokerCallbackEnvelope
} from "./brokerProtocol.js";
import { accountId, type StoredAccount, type TokenStore } from "./storage.js";

const host = process.env.EMAIL_MCP_OAUTH_HOST || "127.0.0.1";
const port = Number(process.env.EMAIL_MCP_OAUTH_PORT || "8741");
const redirectUri = `http://${host}:${port}/oauth/callback`;

const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email"
];

const outlookScopes = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"];

type PendingAuth = {
  provider: "gmail" | "outlook";
  state: string;
  createdAt: number;
};

type OAuthStartResult = {
  authUrl: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  openedBrowser: boolean;
};

export type OAuthStartOptions = {
  openBrowser?: boolean;
};

export class OAuthManager {
  private serverStarted = false;
  private pending = new Map<string, PendingAuth>();

  constructor(private readonly store: TokenStore) {}

  async startGmail(options: OAuthStartOptions = {}): Promise<OAuthStartResult> {
    const state = this.createPending("gmail");
    await this.ensureServer();
    const authUrl = brokerAuthUrl("gmail") || makeGoogleOAuthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: gmailScopes,
      state
    });
    const openedBrowser = await openBrowserIfRequested(authUrl, options.openBrowser);

    return {
      authUrl,
      redirectUri,
      state,
      scopes: gmailScopes,
      openedBrowser
    };
  }

  async startOutlook(options: OAuthStartOptions = {}): Promise<OAuthStartResult> {
    const state = this.createPending("outlook");
    await this.ensureServer();

    const authUrl = brokerAuthUrl("outlook") || directOutlookAuthUrl(state);
    const openedBrowser = await openBrowserIfRequested(authUrl, options.openBrowser);

    return {
      authUrl,
      redirectUri,
      state,
      scopes: outlookScopes,
      openedBrowser
    };
  }

  private createPending(provider: "gmail" | "outlook"): string {
    const state = randomBytes(24).toString("hex");
    this.pending.set(state, { provider, state, createdAt: Date.now() });
    return state;
  }

  private async ensureServer(): Promise<void> {
    if (this.serverStarted) {
      return;
    }

    const server = createServer((req, res) => {
      void this.handleCallback(req, res).catch((error) => {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end(`OAuth failed: ${(error as Error).message}`);
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve();
      });
    });

    this.serverStarted = true;
  }

  private async handleCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", redirectUri);
    if (url.pathname !== "/oauth/callback") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    if (req.method === "POST") {
      const account = await this.finishBrokerCallback(req);
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<h1>Email account connected</h1><p>${escapeHtml(account.email)} is ready. You can close this window.</p>`);
      return;
    }

    const error = url.searchParams.get("error");
    if (error) {
      throw new Error(error);
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      throw new Error("Missing OAuth code or state");
    }

    const pending = this.pending.get(state);
    if (!pending || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      throw new Error("OAuth state is missing or expired");
    }
    this.pending.delete(state);

    const account = pending.provider === "gmail" ? await this.finishGmail(code) : await this.finishOutlook(code);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<h1>Email account connected</h1><p>${escapeHtml(account.email)} is ready.</p>`);
  }

  private async finishBrokerCallback(req: IncomingMessage): Promise<StoredAccount> {
    const publicKeyPem = process.env.EMAIL_MCP_BROKER_PUBLIC_KEY?.replaceAll("\\n", "\n");
    const sharedSecret = process.env.EMAIL_MCP_BROKER_SHARED_SECRET;
    if (!publicKeyPem && !sharedSecret) {
      throw new Error("EMAIL_MCP_BROKER_PUBLIC_KEY or EMAIL_MCP_BROKER_SHARED_SECRET is required for broker callbacks");
    }
    const body = await readBrokerCallbackBody(req);
    const account = verifyBrokerCallbackEnvelope(body, { publicKeyPem, sharedSecret });
    return this.store.upsert({
      id: account.id,
      provider: account.provider,
      email: account.email,
      displayName: account.displayName,
      scopes: account.scopes,
      tokens: account.tokens
    });
  }

  private async finishGmail(code: string): Promise<StoredAccount> {
    const client = makeGoogleOAuthClient();
    const tokenResponse = await client.getToken(code);
    client.setCredentials(tokenResponse.tokens);

    const gmail = google.gmail({ version: "v1", auth: client as never });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress;
    if (!email) {
      throw new Error("Gmail profile did not include an email address");
    }

    return this.store.upsert({
      id: accountId("gmail", email),
      provider: "gmail",
      email,
      scopes: gmailScopes,
      tokens: tokenResponse.tokens as Record<string, unknown>
    });
  }

  private async finishOutlook(code: string): Promise<StoredAccount> {
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const params = new URLSearchParams({
      client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
      code,
      redirect_uri: redirectUri,
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

    return this.store.upsert({
      id: accountId("outlook", email),
      provider: "outlook",
      email,
      displayName: profile.displayName,
      scopes: outlookScopes,
      tokens
    });
  }
}

export function makeGoogleOAuthClient() {
  return new google.auth.OAuth2(requiredEnv("GOOGLE_CLIENT_ID"), requiredEnv("GOOGLE_CLIENT_SECRET"), redirectUri);
}

function brokerAuthUrl(provider: "gmail" | "outlook"): string | undefined {
  const baseUrl = process.env.EMAIL_MCP_AUTH_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return undefined;
  }
  const brokerState = createBrokerSessionState(provider, redirectUri, process.env.EMAIL_MCP_BROKER_SHARED_SECRET);
  const path = provider === "gmail" ? "/auth/gmail/start" : "/auth/outlook/start";
  return `${baseUrl}${path}?${new URLSearchParams({ state: brokerState }).toString()}`;
}

function directOutlookAuthUrl(state: string): string {
  const clientId = requiredEnv("MICROSOFT_CLIENT_ID");
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: outlookScopes.join(" "),
    state
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function refreshOutlookToken(account: StoredAccount, store: TokenStore): Promise<string> {
  const refreshToken = account.tokens.refresh_token;
  if (typeof refreshToken !== "string") {
    throw new Error(`Outlook account ${account.id} is missing a refresh token; reconnect it.`);
  }

  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  const params = new URLSearchParams({
    client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
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
  if (!response.ok || typeof tokens.access_token !== "string") {
    throw new Error(`Microsoft token refresh failed: ${JSON.stringify(tokens)}`);
  }
  await store.updateTokens(account.id, tokens);
  return tokens.access_token;
}

export async function graphFetch<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new Error(`Graph request failed (${response.status}): ${text}`);
  }
  return body as T;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function readBrokerCallbackBody(req: IncomingMessage): Promise<BrokerCallbackEnvelope> {
  const raw = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const envelope = new URLSearchParams(raw).get("envelope");
    if (!envelope) {
      throw new Error("Broker callback form is missing envelope");
    }
    return JSON.parse(envelope) as BrokerCallbackEnvelope;
  }
  return JSON.parse(raw) as BrokerCallbackEnvelope;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function openBrowserIfRequested(url: string, openBrowser = true): Promise<boolean> {
  if (!openBrowser) {
    return false;
  }

  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "powershell.exe" : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process -FilePath $args[0]", url]
      : [url];

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return true;
  } catch {
    if (process.platform !== "win32") {
      return false;
    }
    return openWindowsBrowserWithCmd(url);
  }
}

function openWindowsBrowserWithCmd(url: string): boolean {
  try {
    const escapedUrl = url.replaceAll("&", "^&");
    const child = spawn("cmd", ["/c", "start", "\"\"", escapedUrl], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
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
