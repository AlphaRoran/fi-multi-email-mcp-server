import { mkdir, readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { callEmailMcpTool } from "../lib/mcpClient.js";
import { writeJson, type AccountsConfig, type LabelsConfig, type Policy } from "../lib/profile.js";

type Account = { id: string; provider: "gmail" | "outlook"; email: string };
type SetupInput = {
  clientName: string;
  clientSlug?: string;
  accounts: AccountsConfig["accounts"];
  operatingStyle?: string;
  projectSystem?: string;
  notificationPreference?: string;
  checkCadenceMinutes?: number;
  escalationChannels?: string[];
  mode?: "dry-run" | "label-only";
  allowAutoLabel?: boolean;
  notes?: string;
};

const rl = createInterface({ input, output });

main().catch((error) => {
  rl.close();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  try {
  const jsonPath = argValue("--from-json");
  if (jsonPath) {
    const setup = JSON.parse(await readFile(resolve(jsonPath), "utf8")) as SetupInput;
    await createProfile(setup);
    return;
  }

  const clientName = await ask("Client/business name");
  const clientSlug = slugify((await ask("Client slug", slugify(clientName))) || clientName);
  const connectedAccounts = await safeListAccounts();

  console.log("\nConnected accounts:");
  for (const [index, account] of connectedAccounts.entries()) {
    console.log(`${index + 1}. ${account.id}`);
  }
  console.log("Use the account IDs above when assigning accounts. Leave blank when done.\n");

  const accounts: AccountsConfig = { accounts: {} };
  while (true) {
    const accountId = await ask("Account ID to include");
    if (!accountId) {
      break;
    }
    const lane = await ask("Lane/project area for this inbox", "primary");
    const role = await ask("Role of this inbox", "owner-primary");
    const priority = await ask("Priority high/medium/low", "high");
    const notes = await ask("Notes", "");
    accounts.accounts[accountId] = { lane, role, priority, notes };
  }

  const operatingStyle = await askChoice("Operating style", ["balanced", "hands-off", "high-touch"]);
  const projectSystem = await ask("Where should projects/tasks be stored? Examples: Notion, Linear, Asana, Google Sheet", "Notion");
  const notificationPreference = await askChoice("Notification preference", ["attention-only", "digest-only", "all-new-mail"]);
  const checkCadenceMinutes = Number(await ask("How often should the inbox be checked? Minutes", "5"));
  const escalationChannels = splitList(await ask("Notification/escalation channels. Examples: email, Slack, SMS, Notion", "digest"));
  const mode = await askChoice("Starting mode", ["dry-run", "label-only"]);
  const allowAutoLabel = mode === "label-only" && (await askChoice("Allow automatic labels/categories now?", ["no", "yes"])) === "yes";
  const notes = await ask("Anything special the agent should know?", "");

  await createProfile({
    clientName,
    clientSlug,
    accounts: accounts.accounts,
    operatingStyle,
    projectSystem,
    notificationPreference,
    checkCadenceMinutes,
    escalationChannels,
    mode,
    allowAutoLabel,
    notes
  });
  } finally {
    rl.close();
  }
}

async function createProfile(setup: SetupInput): Promise<void> {
  const clientSlug = slugify(setup.clientSlug || setup.clientName);
  const profileDir = resolve("profiles/clients", clientSlug);
  const labels = await loadDefaultLabels();
  const policy: Policy = {
    mode: setup.mode || "dry-run",
    client: {
      clientName: setup.clientName,
      clientSlug,
      operatingStyle: setup.operatingStyle || "balanced",
      projectSystem: setup.projectSystem || "Notion",
      notificationPreference: setup.notificationPreference || "attention-only",
      checkCadenceMinutes:
        Number.isFinite(setup.checkCadenceMinutes) && Number(setup.checkCadenceMinutes) > 0 ? Number(setup.checkCadenceMinutes) : 5,
      escalationChannels: setup.escalationChannels?.length ? setup.escalationChannels : ["digest"],
      approvalRules: {
        requireApprovalBeforeSend: true,
        requireApprovalBeforeArchive: true,
        requireApprovalBeforeDelete: true,
        requireApprovalBeforeUnsubscribe: true
      },
      notes: setup.notes || ""
    },
    projectContext: {
      enabled: true,
      destination: "state-file",
      requireApprovalBeforeExternalWrite: true,
      captureWhen: ["needs_review", "needs_reply", "client", "lead", "billing", "scheduling"],
      defaultProjectStatus: "candidate"
    },
    primaryWatchdog: {
      gmailQuery: "in:inbox newer_than:1d",
      outlookQuery: "isRead eq false",
      maxResultsPerAccount: 10
    },
    safeAutomation: {
      allowAutoLabel: Boolean(setup.allowAutoLabel),
      allowAutoMarkRead: false,
      allowAutoArchive: false,
      allowAutoTrash: false,
      allowAutoSend: false,
      allowAutoUnsubscribe: false
    },
    notifyWhen: notifyKeysFor(setup.notificationPreference || "attention-only")
  };

  await mkdir(profileDir, { recursive: true });
  await writeJson(resolve(profileDir, "accounts.json"), { accounts: setup.accounts });
  await writeJson(resolve(profileDir, "policy.json"), policy);
  await writeJson(resolve(profileDir, "labels.json"), labels);

  console.log(`\nCreated profile: ${profileDir}`);
  console.log(`Run: EMAIL_MCP_PROFILE=${relativeProfile(profileDir)} npm run automation:operator`);
  if (setup.allowAutoLabel) {
    console.log(`Bootstrap labels first: EMAIL_MCP_PROFILE=${relativeProfile(profileDir)} npm run automation:bootstrap-labels`);
  }
}

async function ask(prompt: string, defaultValue = ""): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = (await rl.question(`${prompt}${suffix}: `)).trim();
  return answer || defaultValue;
}

async function askChoice<T extends string>(prompt: string, choices: T[]): Promise<T> {
  const answer = await ask(`${prompt} [${choices.join("/")}]`, choices[0]);
  if (choices.includes(answer as T)) {
    return answer as T;
  }
  return choices[0];
}

async function safeListAccounts(): Promise<Account[]> {
  try {
    return await callEmailMcpTool<Account[]>("list_accounts");
  } catch (error) {
    console.warn(`Could not list accounts: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function loadDefaultLabels(): Promise<LabelsConfig> {
  const raw = await readFile(resolve("templates/client-framework/labels.default.json"), "utf8");
  return JSON.parse(raw) as LabelsConfig;
}

function notifyKeysFor(preference: string): string[] {
  if (preference === "all-new-mail") {
    return ["needs_review", "needs_reply", "client", "lead", "billing", "scheduling", "newsletter", "low_priority"];
  }
  if (preference === "digest-only") {
    return ["needs_review", "needs_reply", "client", "lead", "billing", "scheduling"];
  }
  return ["needs_review", "needs_reply", "lead", "billing", "scheduling"];
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function relativeProfile(profileDir: string): string {
  return profileDir.replace(`${process.cwd()}/`, "");
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
