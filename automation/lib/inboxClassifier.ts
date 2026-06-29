import type { AutomationProfile } from "./profile.js";

export type EmailAccount = { id: string; provider: "gmail" | "outlook"; email: string };

export type EmailMessage = {
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

export type Classification = {
  labelKeys: string[];
  labelNames: string[];
  reasons: string[];
  suggestedActions: string[];
  importance: "high" | "medium" | "low";
};

export function classifyMessage(message: EmailMessage, accountId: string, profile: AutomationProfile): Classification {
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
  const suggestedActions: string[] = [];

  if (account?.role === "company") {
    labelKeys.push("client");
    reasons.push("company inbox");
  }
  if (/invoice|receipt|payment|paid|bill|statement/.test(text)) {
    labelKeys.push("billing");
    reasons.push("money/billing keyword");
    suggestedActions.push("review billing context before archiving");
  }
  if (/schedule|meeting|calendar|call|zoom|meet|appointment/.test(text)) {
    labelKeys.push("scheduling");
    reasons.push("scheduling keyword");
    suggestedActions.push("check calendar before replying");
  }
  if (/lead|quote|proposal|interested|website|services|consult/.test(text)) {
    labelKeys.push("lead");
    reasons.push("lead/opportunity keyword");
    suggestedActions.push("prepare a concise follow-up draft");
  }
  if (/unsubscribe|newsletter|digest|promotion|sale|discount|marketing copy|before you post|start writing/.test(text)) {
    labelKeys.push("newsletter");
    reasons.push("newsletter/subscription keyword");
    suggestedActions.push("review later or archive after approval");
  }
  if (/alert|anomaly|500 error|errors spike|incident|outage|failed|failure|security|password|login|verification code/.test(text)) {
    labelKeys.push("needs_review");
    reasons.push("operational/security alert keyword");
    suggestedActions.push("inspect the affected service or account");
  }
  if (/[?]|can you|could you|please|urgent|asap|action required/.test(text)) {
    labelKeys.push("needs_review");
    reasons.push("direct ask or urgency signal");
    suggestedActions.push("open and decide whether a reply is needed");
  }
  if (labelKeys.length === 0) {
    labelKeys.push(account?.priority === "low" ? "low_priority" : "review_later");
    reasons.push("no strong rule matched");
    suggestedActions.push("scan during batch review");
  }

  const uniqueKeys = [...new Set(labelKeys)];
  return {
    labelKeys: uniqueKeys,
    labelNames: uniqueKeys.map((key) => labelNameForKey(profile, key)),
    reasons: [...new Set(reasons)],
    suggestedActions: [...new Set(suggestedActions)],
    importance: importanceFor(uniqueKeys, account?.priority)
  };
}

export function labelNameForKey(profile: AutomationProfile, key: string): string {
  return profile.labels.labels.find((label) => label.key === key)?.name || key;
}

export function senderDisplay(from: EmailMessage["from"]): string {
  if (!from) {
    return "(unknown sender)";
  }
  if (typeof from === "string") {
    return from;
  }
  return from.address || from.name || "(unknown sender)";
}

export function messageReceivedAt(message: EmailMessage): string | undefined {
  return message.receivedDateTime || message.date;
}

function importanceFor(labelKeys: string[], accountPriority: string | undefined): Classification["importance"] {
  if (labelKeys.some((key) => ["needs_review", "lead", "billing", "scheduling"].includes(key))) {
    return "high";
  }
  if (accountPriority === "high" && !labelKeys.includes("newsletter") && !labelKeys.includes("low_priority")) {
    return "medium";
  }
  if (labelKeys.includes("newsletter") || labelKeys.includes("low_priority")) {
    return "low";
  }
  return "medium";
}
