import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type Provider = "gmail" | "outlook";

export type StoredAccount = {
  id: string;
  provider: Provider;
  email: string;
  displayName?: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  tokens: Record<string, unknown>;
};

type TokenStoreFile = {
  version: 1;
  accounts: StoredAccount[];
};

const defaultStorePath = join(homedir(), ".fender-industries", "email-mcp", "tokens.json");

export class TokenStore {
  readonly path: string;

  constructor(path = process.env.EMAIL_MCP_TOKEN_STORE || defaultStorePath) {
    this.path = path;
  }

  async list(): Promise<StoredAccount[]> {
    return (await this.read()).accounts;
  }

  async get(accountId: string): Promise<StoredAccount> {
    const account = (await this.list()).find((item) => item.id === accountId);
    if (!account) {
      throw new Error(`Unknown accountId: ${accountId}`);
    }
    return account;
  }

  async upsert(input: Omit<StoredAccount, "createdAt" | "updatedAt">): Promise<StoredAccount> {
    const store = await this.read();
    const now = new Date().toISOString();
    const existingIndex = store.accounts.findIndex((item) => item.id === input.id);
    const next: StoredAccount = {
      ...input,
      createdAt: existingIndex >= 0 ? store.accounts[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      store.accounts[existingIndex] = next;
    } else {
      store.accounts.push(next);
    }

    await this.write(store);
    return next;
  }

  async updateTokens(accountId: string, tokens: Record<string, unknown>): Promise<void> {
    const store = await this.read();
    const account = store.accounts.find((item) => item.id === accountId);
    if (!account) {
      throw new Error(`Unknown accountId: ${accountId}`);
    }
    account.tokens = { ...account.tokens, ...tokens };
    account.updatedAt = new Date().toISOString();
    await this.write(store);
  }

  async remove(accountId: string): Promise<boolean> {
    const store = await this.read();
    const originalLength = store.accounts.length;
    store.accounts = store.accounts.filter((item) => item.id !== accountId);
    if (store.accounts.length === originalLength) {
      return false;
    }
    await this.write(store);
    return true;
  }

  private async read(): Promise<TokenStoreFile> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as TokenStoreFile;
      return { version: 1, accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: 1, accounts: [] };
      }
      throw error;
    }
  }

  private async write(store: TokenStoreFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, this.path);
  }
}

export function accountId(provider: Provider, email: string): string {
  return `${provider}:${email.toLowerCase()}`;
}
