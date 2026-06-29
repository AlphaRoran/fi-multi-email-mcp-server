import "dotenv/config";
import { OAuthManager } from "./oauth.js";
import { TokenStore, type Provider, type StoredAccount } from "./storage.js";

const provider = process.argv[2] as Provider | undefined;

if (provider !== "gmail" && provider !== "outlook") {
  console.error("Usage: npm run auth:outlook OR npm run auth:gmail");
  process.exit(1);
}

const store = new TokenStore();
const oauth = new OAuthManager(store);
const startedAt = Date.now();
const before = await safeAccounts(store);
const beforeUpdated = new Map(before.filter((account) => account.provider === provider).map((account) => [account.id, account.updatedAt]));
const result = provider === "outlook" ? await oauth.startOutlook({ openBrowser: true }) : await oauth.startGmail({ openBrowser: true });

console.log(`Started ${provider} OAuth.`);
console.log(`Callback listener: ${result.redirectUri}`);
console.log(`Browser opened: ${result.openedBrowser ? "yes" : "no"}`);
console.log(`Auth URL: ${result.authUrl}`);
console.log("Leave this terminal open until the browser says the email account is connected.");

const connected = await waitForConnectedAccount(store, provider, beforeUpdated, startedAt);
console.log(`Connected account: ${connected.id}`);
process.exit(0);

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
  while (true) {
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
