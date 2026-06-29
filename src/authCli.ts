import "dotenv/config";
import { OAuthManager } from "./oauth.js";
import { TokenStore, type Provider, type StoredAccount } from "./storage.js";

const provider = process.argv[2] as Provider | undefined;
const openBrowser = !process.argv.includes("--manual") && !process.argv.includes("--no-browser");

if (provider !== "gmail" && provider !== "outlook") {
  console.error("Usage: npm run auth:outlook OR npm run auth:gmail");
  process.exit(1);
}
const selectedProvider: Provider = provider;

main().catch((error) => {
  printHelpfulAuthError(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const store = new TokenStore();
  const oauth = new OAuthManager(store);
  const startedAt = Date.now();
  const before = await safeAccounts(store);
  const beforeUpdated = new Map(before.filter((account) => account.provider === selectedProvider).map((account) => [account.id, account.updatedAt]));
  const result = selectedProvider === "outlook" ? await oauth.startOutlook({ openBrowser }) : await oauth.startGmail({ openBrowser });

  console.log(`Started ${selectedProvider} OAuth.`);
  console.log(`Callback listener: ${result.redirectUri}`);
  console.log(`Browser opened: ${result.openedBrowser ? "yes" : "no"}`);
  console.log(`Auth URL: ${result.authUrl}`);
  if (!result.openedBrowser) {
    console.log("Open the Auth URL manually in a browser.");
  }
  console.log("Leave this terminal open until the browser says the email account is connected.");

  const connected = await waitForConnectedAccount(store, selectedProvider, beforeUpdated, startedAt);
  console.log(`Connected account: ${connected.id}`);
}

async function safeAccounts(tokenStore: TokenStore): Promise<StoredAccount[]> {
  try {
    return await tokenStore.list();
  } catch {
    return [];
  }
}

async function waitForConnectedAccount(
  tokenStore: TokenStore,
  selectedProvider: Provider,
  previousUpdatedAt: Map<string, string>,
  startTime: number
): Promise<StoredAccount> {
  const timeoutMs = 11 * 60 * 1000;
  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error("OAuth timed out. The consent link expires after about 10 minutes. Run the auth command again.");
    }
    const accounts = await safeAccounts(tokenStore);
    const connected = accounts.find((account) => {
      if (account.provider !== selectedProvider) {
        return false;
      }
      const previous = previousUpdatedAt.get(account.id);
      if (!previous) {
        return Date.parse(account.updatedAt) >= startTime - 5_000;
      }
      return account.updatedAt !== previous && Date.parse(account.updatedAt) >= startTime - 5_000;
    });
    if (connected) {
      return connected;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

function printHelpfulAuthError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`OAuth setup failed: ${message}`);

  if (message.includes("EADDRINUSE") || message.includes("address already in use")) {
    console.error("");
    console.error("The local OAuth callback port is already being used. This usually means an old auth/server process is still running.");
    console.error("");
    console.error("On Windows PowerShell, find and stop the process:");
    console.error("  netstat -ano | findstr :8741");
    console.error("  taskkill /PID <PID_FROM_NETSTAT> /F");
    console.error("");
    console.error("Then rerun:");
    console.error(`  npm run auth:${selectedProvider}`);
  }

  if (/scope|AADSTS650053|invalid_scope/i.test(message)) {
    console.error("");
    console.error("Microsoft scope check:");
    console.error("  App type must allow the account being used: personal Microsoft accounts, work/school accounts, or both.");
    console.error("  Redirect URI for hosted broker: https://auth.fenderindustries.com/auth/outlook/callback");
    console.error("  Redirect URI for direct local fallback: http://127.0.0.1:8741/oauth/callback");
    console.error("  Delegated Microsoft Graph/OpenID scopes needed:");
    console.error("    openid, profile, email, offline_access, User.Read, Mail.ReadWrite, Mail.Send");
  }
}
