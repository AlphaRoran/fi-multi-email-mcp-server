import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type AccountConfig = {
  lane: string;
  role: string;
  priority: "high" | "medium" | "low" | string;
  notes?: string;
};

export type AccountsConfig = {
  accounts: Record<string, AccountConfig>;
};

export type AutomationMode = "dry-run" | "label-only" | "assistive" | "managed";

export type Policy = {
  mode: AutomationMode;
  primaryWatchdog: {
    gmailQuery: string;
    outlookQuery: string;
    maxResultsPerAccount: number;
  };
  safeAutomation: {
    allowAutoLabel: boolean;
    allowAutoMarkRead: boolean;
    allowAutoArchive: boolean;
    allowAutoTrash: boolean;
    allowAutoSend: boolean;
    allowAutoUnsubscribe: boolean;
  };
  notifyWhen: string[];
};

export type LabelDefinition = {
  key: string;
  name: string;
};

export type LabelsConfig = {
  labels: LabelDefinition[];
};

export type ProcessedState = {
  processed: Record<string, { processedAt: string; labels: string[] }>;
  lastRunAt: string | null;
};

export type LabelMapState = {
  accounts: Record<string, Record<string, string>>;
  updatedAt: string | null;
};

export type ApprovalQueueState = {
  items: ApprovalQueueItem[];
  updatedAt: string | null;
};

export type ApprovalQueueItem = {
  key: string;
  status: "open" | "approved" | "dismissed" | "done";
  accountId: string;
  provider: "gmail" | "outlook";
  lane: string;
  accountPriority: string;
  messageId: string;
  threadId?: string;
  subject: string;
  from: string;
  receivedAt?: string;
  snippet: string;
  labelKeys: string[];
  labelNames: string[];
  reasons: string[];
  suggestedActions: string[];
  importance: "high" | "medium" | "low";
  attention: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type AutomationProfile = {
  profileDir: string;
  accounts: AccountsConfig;
  policy: Policy;
  labels: LabelsConfig;
  statePaths: {
    processed: string;
    labelMap: string;
    approvalQueue: string;
  };
};

const defaultProfile = "profiles/caleb-local";

export async function loadProfile(): Promise<AutomationProfile> {
  const profileDir = resolve(process.env.EMAIL_MCP_PROFILE || defaultProfile);
  const stateDir = resolve(profileDir, "state");
  await mkdir(stateDir, { recursive: true });

  const statePaths = {
    processed: resolve(stateDir, "processed.json"),
    labelMap: resolve(stateDir, "label-map.json"),
    approvalQueue: resolve(stateDir, "approval-queue.json")
  };

  await ensureJson(statePaths.processed, { processed: {}, lastRunAt: null });
  await ensureJson(statePaths.labelMap, { accounts: {}, updatedAt: null });
  await ensureJson(statePaths.approvalQueue, { items: [], updatedAt: null });

  return {
    profileDir,
    accounts: await readJson<AccountsConfig>(resolve(profileDir, "accounts.json")),
    policy: await readJson<Policy>(resolve(profileDir, "policy.json")),
    labels: await readJson<LabelsConfig>(resolve(profileDir, "labels.json")),
    statePaths
  };
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function ensureJson(path: string, defaultValue: unknown): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await writeJson(path, defaultValue);
  }
}
