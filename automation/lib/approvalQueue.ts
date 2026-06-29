import { readJson, writeJson, type ApprovalQueueItem, type ApprovalQueueState, type AutomationProfile } from "./profile.js";
import { messageReceivedAt, senderDisplay, type Classification, type EmailAccount, type EmailMessage } from "./inboxClassifier.js";

export type QueueUpsertInput = {
  account: EmailAccount;
  message: EmailMessage;
  classification: Classification;
  profile: AutomationProfile;
  attention: boolean;
};

export async function upsertApprovalItems(profile: AutomationProfile, inputs: QueueUpsertInput[]): Promise<ApprovalQueueState> {
  const queue = await readJson<ApprovalQueueState>(profile.statePaths.approvalQueue);
  const existing = new Map(queue.items.map((item) => [item.key, item]));
  const now = new Date().toISOString();

  for (const input of inputs) {
    const accountConfig = input.profile.accounts.accounts[input.account.id];
    const key = `${input.account.id}:${input.message.id}`;
    const previous = existing.get(key);
    existing.set(key, {
      key,
      status: previous?.status || "open",
      accountId: input.account.id,
      provider: input.account.provider,
      lane: accountConfig?.lane || "unassigned",
      accountPriority: accountConfig?.priority || "medium",
      messageId: input.message.id,
      threadId: input.message.threadId,
      subject: input.message.subject || "(no subject)",
      from: senderDisplay(input.message.from),
      receivedAt: messageReceivedAt(input.message),
      snippet: input.message.snippet || input.message.bodyPreview || "",
      labelKeys: input.classification.labelKeys,
      labelNames: input.classification.labelNames,
      reasons: input.classification.reasons,
      suggestedActions: input.classification.suggestedActions,
      importance: input.classification.importance,
      attention: input.attention,
      firstSeenAt: previous?.firstSeenAt || now,
      lastSeenAt: now
    });
  }

  const next: ApprovalQueueState = {
    items: [...existing.values()].sort(compareQueueItems),
    updatedAt: now
  };
  await writeJson(profile.statePaths.approvalQueue, next);
  return next;
}

export function isNotifiable(classification: Classification, profile: AutomationProfile): boolean {
  return classification.labelKeys.some((key) => profile.policy.notifyWhen.includes(key));
}

export function openItems(queue: ApprovalQueueState): ApprovalQueueItem[] {
  return queue.items.filter((item) => item.status === "open");
}

export function compareQueueItems(a: ApprovalQueueItem, b: ApprovalQueueItem): number {
  const importanceDelta = importanceRank(b.importance) - importanceRank(a.importance);
  if (importanceDelta !== 0) {
    return importanceDelta;
  }
  return String(b.receivedAt || b.lastSeenAt).localeCompare(String(a.receivedAt || a.lastSeenAt));
}

function importanceRank(importance: ApprovalQueueItem["importance"]): number {
  if (importance === "high") {
    return 3;
  }
  if (importance === "medium") {
    return 2;
  }
  return 1;
}
