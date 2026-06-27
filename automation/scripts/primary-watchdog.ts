import { callEmailMcpTool } from "../lib/mcpClient.js";
import { loadProfile, readJson, writeJson, type AutomationProfile, type ProcessedState } from "../lib/profile.js";

type Account = { id: string; provider: "gmail" | "outlook"; email: string };
type Message = {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string | { name?: string; address?: string };
  to?: unknown;
  date?: string;
  receivedDateTime?: string;
  snippet?: string;
  bodyPreview?: string;
};
type SearchResponse = { accountId: string; provider: string; messages: Message[] };
type LabelMapState = { accounts: Record<string, Record<string, string>>; updatedAt: string | null };

type Classification = {
  labelKeys: string[];
  labelNames: string[];
  reasons: string[];
};

function classify(message: Message, accountId: string, profile: AutomationProfile): Classification {
  const text = [
    message.subject,
    typeof message.from === "string" ? message.from : message.from?.address,
    message.snippet,
    message.bodyPreview
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const account = profile.accounts.accounts[accountId];
  const labelKeys: string[] = [];
  const reasons: string[] = [];

  if (account?.role === "company") {
    labelKeys.push("client");
    reasons.push("company inbox");
  }
  if (/invoice|receipt|payment|paid|bill|statement/.test(text)) {
    labelKeys.push("billing");
    reasons.push("money/billing keyword");
  }
  if (/schedule|meeting|calendar|call|zoom|meet|appointment/.test(text)) {
    labelKeys.push("scheduling");
    reasons.push("scheduling keyword");
  }
  if (/lead|quote|proposal|interested|website|services|consult/.test(text)) {
    labelKeys.push("lead");
    reasons.push("lead/opportunity keyword");
  }
  if (/unsubscribe|newsletter|digest|promotion|sale|discount/.test(text)) {
    labelKeys.push("newsletter");
    reasons.push("newsletter/subscription keyword");
  }
  if (/[?]|can you|could you|please|urgent|asap|action required/.test(text)) {
    labelKeys.push("needs_review");
    reasons.push("direct ask or urgency signal");
  }
  if (labelKeys.length === 0) {
    labelKeys.push(account?.priority === "low" ? "low_priority" : "review_later");
    reasons.push("no strong rule matched");
  }

  const uniqueKeys = [...new Set(labelKeys)];
  return {
    labelKeys: uniqueKeys,
    labelNames: uniqueKeys.map((key) => labelNameForKey(profile, key)),
    reasons
  };
}

async function maybeApplyLabels(
  account: Account,
  message: Message,
  classification: Classification,
  profile: AutomationProfile,
  labelMap: LabelMapState
) {
  if (profile.policy.mode !== "label-only") {
    return { applied: false, reason: `mode is ${profile.policy.mode}` };
  }
  if (!profile.policy.safeAutomation.allowAutoLabel) {
    return { applied: false, reason: "allowAutoLabel is false" };
  }

  if (account.provider === "gmail") {
    const mapped = classification.labelKeys.map((key) => labelMap.accounts[account.id]?.[key]).filter(Boolean);
    const missing = classification.labelKeys.filter((key) => !labelMap.accounts[account.id]?.[key]);
    if (missing.length > 0) {
      return { applied: false, reason: `missing label map for ${missing.join(", ")}` };
    }
    await callEmailMcpTool("modify_message", {
      accountId: account.id,
      messageId: message.id,
      addLabels: mapped
    });
    return { applied: true, labels: mapped };
  }

  await callEmailMcpTool("modify_message", {
    accountId: account.id,
    messageId: message.id,
    addCategories: classification.labelNames
  });
  return { applied: true, categories: classification.labelNames };
}

function labelNameForKey(profile: AutomationProfile, key: string): string {
  return profile.labels.labels.find((label) => label.key === key)?.name || key;
}

function senderDisplay(from: Message["from"]): string {
  if (!from) {
    return "(unknown sender)";
  }
  if (typeof from === "string") {
    return from;
  }
  return from.address || from.name || "(unknown sender)";
}

const profile = await loadProfile();
const state = await readJson<ProcessedState>(profile.statePaths.processed);
const labelMap = await readJson<LabelMapState>(profile.statePaths.labelMap);
const accounts = await callEmailMcpTool<Account[]>("list_accounts");
const configuredAccounts = accounts.filter((account) => profile.accounts.accounts[account.id]);
const report = [];

for (const account of configuredAccounts) {
  const query = account.provider === "gmail" ? profile.policy.primaryWatchdog.gmailQuery : profile.policy.primaryWatchdog.outlookQuery;

  try {
    const response = await callEmailMcpTool<SearchResponse>("search_messages", {
      accountId: account.id,
      query,
      maxResults: profile.policy.primaryWatchdog.maxResultsPerAccount
    });

    const messages = response.messages || [];
    const newMessages = messages.filter((message) => !state.processed[`${account.id}:${message.id}`]);
    const classified = [];

    for (const message of newMessages) {
      const classification = classify(message, account.id, profile);
      const action = await maybeApplyLabels(account, message, classification, profile, labelMap);
      classified.push({
        id: message.id,
        subject: message.subject || "(no subject)",
        from: senderDisplay(message.from),
        snippet: message.snippet || message.bodyPreview || "",
        classification,
        action
      });
      if (profile.policy.mode === "label-only" && action.applied) {
        state.processed[`${account.id}:${message.id}`] = {
          processedAt: new Date().toISOString(),
          labels: classification.labelNames
        };
      }
    }

    report.push({
      accountId: account.id,
      lane: profile.accounts.accounts[account.id].lane,
      query,
      found: messages.length,
      new: newMessages.length,
      classified
    });
  } catch (error) {
    report.push({
      accountId: account.id,
      lane: profile.accounts.accounts[account.id].lane,
      query,
      found: 0,
      new: 0,
      error: error instanceof Error ? error.message : String(error),
      classified: []
    });
  }
}

state.lastRunAt = new Date().toISOString();
await writeJson(profile.statePaths.processed, state);
console.log(JSON.stringify({ mode: profile.policy.mode, profile: profile.profileDir, report }, null, 2));
