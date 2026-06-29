import { callEmailMcpTool } from "../lib/mcpClient.js";
import { loadProfile, readJson, writeJson, type AutomationProfile, type ProcessedState } from "../lib/profile.js";
import { isNotifiable, upsertApprovalItems, type QueueUpsertInput } from "../lib/approvalQueue.js";
import { classifyMessage, senderDisplay, type Classification, type EmailAccount, type EmailMessage } from "../lib/inboxClassifier.js";

type SearchResponse = { accountId: string; provider: string; messages: EmailMessage[] };
type LabelMapState = { accounts: Record<string, Record<string, string>>; updatedAt: string | null };

async function maybeApplyLabels(
  account: EmailAccount,
  message: EmailMessage,
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

const profile = await loadProfile();
const state = await readJson<ProcessedState>(profile.statePaths.processed);
const labelMap = await readJson<LabelMapState>(profile.statePaths.labelMap);
const accounts = await callEmailMcpTool<EmailAccount[]>("list_accounts");
const configuredAccounts = accounts.filter((account) => profile.accounts.accounts[account.id]);
const report = [];
const queueInputs: QueueUpsertInput[] = [];

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
      const classification = classifyMessage(message, account.id, profile);
      const action = await maybeApplyLabels(account, message, classification, profile, labelMap);
      queueInputs.push({ account, message, classification, profile, attention: isNotifiable(classification, profile) });
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
const approvalQueue = await upsertApprovalItems(profile, queueInputs);
console.log(JSON.stringify({ mode: profile.policy.mode, profile: profile.profileDir, queued: queueInputs.length, attentionQueued: queueInputs.filter((item) => item.attention).length, approvalQueueOpen: approvalQueue.items.filter((item) => item.status === "open").length, report }, null, 2));
