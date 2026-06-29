import { readJson, writeJson, type AutomationProfile, type ProjectContextItem, type ProjectContextState } from "./profile.js";
import { messageReceivedAt, senderDisplay, type Classification, type EmailAccount, type EmailMessage } from "./inboxClassifier.js";

export type ProjectContextInput = {
  account: EmailAccount;
  message: EmailMessage;
  classification: Classification;
  profile: AutomationProfile;
};

const projectSignalKeys = ["lead", "client", "billing", "scheduling", "needs_review"];

export function shouldCaptureProjectContext(input: ProjectContextInput): boolean {
  const policy = input.profile.policy.projectContext;
  if (policy && !policy.enabled) {
    return false;
  }
  const captureWhen = policy?.captureWhen?.length ? policy.captureWhen : projectSignalKeys;
  return input.classification.labelKeys.some((key) => captureWhen.includes(key));
}

export async function upsertProjectContextItems(profile: AutomationProfile, inputs: ProjectContextInput[]): Promise<ProjectContextState> {
  const state = await readJson<ProjectContextState>(profile.statePaths.projectContext);
  const existing = new Map(state.items.map((item) => [item.key, item]));
  const now = new Date().toISOString();

  for (const input of inputs) {
    const accountConfig = profile.accounts.accounts[input.account.id];
    const key = `${input.account.id}:${input.message.threadId || input.message.id}`;
    existing.set(key, makeProjectContextItem(input, existing.get(key), now, accountConfig?.lane || "unassigned"));
  }

  const nextState: ProjectContextState = {
    items: [...existing.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    updatedAt: now
  };
  await writeJson(profile.statePaths.projectContext, nextState);
  return nextState;
}

function makeProjectContextItem(
  input: ProjectContextInput,
  previous: ProjectContextItem | undefined,
  now: string,
  lane: string
): ProjectContextItem {
  const subject = input.message.subject || "(no subject)";
  const snippet = compact(input.message.snippet || input.message.bodyPreview || "");
  const projectTitle = previous?.projectTitle || inferProjectTitle(subject, lane);
  return {
    key: previous?.key || `${input.account.id}:${input.message.threadId || input.message.id}`,
    status: previous?.status || "candidate",
    accountId: input.account.id,
    lane,
    messageId: input.message.id,
    threadId: input.message.threadId,
    sourceSubject: subject,
    sourceFrom: senderDisplay(input.message.from),
    sourceReceivedAt: messageReceivedAt(input.message),
    projectTitle,
    projectKey: slugify(projectTitle),
    contextSummary: snippet || `Email from ${senderDisplay(input.message.from)} about ${subject}.`,
    planCandidate: {
      goal: inferGoal(subject, input.classification.labelKeys),
      nextActions: inferNextActions(input.classification.labelKeys),
      openQuestions: inferOpenQuestions(input.classification.labelKeys),
      risks: inferRisks(input.classification.labelKeys)
    },
    labelKeys: input.classification.labelKeys,
    createdAt: previous?.createdAt || now,
    updatedAt: now
  };
}

function inferProjectTitle(subject: string, lane: string): string {
  const cleaned = subject.replace(/^(re|fw|fwd):\s*/i, "").trim();
  if (!cleaned || cleaned === "(no subject)") {
    return `${titleCase(lane)} Inbox Follow-up`;
  }
  return cleaned.slice(0, 100);
}

function inferGoal(subject: string, labelKeys: string[]): string {
  if (labelKeys.includes("lead")) {
    return `Qualify and follow up on: ${subject}`;
  }
  if (labelKeys.includes("scheduling")) {
    return `Resolve scheduling request: ${subject}`;
  }
  if (labelKeys.includes("billing")) {
    return `Review billing item: ${subject}`;
  }
  return `Review and plan response for: ${subject}`;
}

function inferNextActions(labelKeys: string[]): string[] {
  const actions = new Set<string>();
  if (labelKeys.includes("lead")) {
    actions.add("Identify service requested and desired outcome");
    actions.add("Draft a short qualifying reply");
  }
  if (labelKeys.includes("scheduling")) {
    actions.add("Check calendar availability");
    actions.add("Propose two clear time options");
  }
  if (labelKeys.includes("billing")) {
    actions.add("Confirm invoice/payment context");
    actions.add("Flag for owner review before replying");
  }
  if (labelKeys.includes("needs_review")) {
    actions.add("Read the full thread before action");
  }
  if (actions.size === 0) {
    actions.add("Batch review and decide whether to archive, reply, or create a task");
  }
  return [...actions];
}

function inferOpenQuestions(labelKeys: string[]): string[] {
  const questions = new Set<string>();
  if (labelKeys.includes("lead")) {
    questions.add("Is this a qualified opportunity?");
    questions.add("Which project or pipeline should this map to?");
  }
  if (labelKeys.includes("client")) {
    questions.add("Is this tied to an existing client project?");
  }
  if (labelKeys.includes("billing")) {
    questions.add("Does this require owner approval or accounting follow-up?");
  }
  if (questions.size === 0) {
    questions.add("Does this email require a project, task, reply, or no action?");
  }
  return [...questions];
}

function inferRisks(labelKeys: string[]): string[] {
  const risks = new Set<string>();
  if (labelKeys.includes("billing")) {
    risks.add("Financial message should not be archived or answered automatically");
  }
  if (labelKeys.includes("needs_review")) {
    risks.add("Needs human review before taking external action");
  }
  if (labelKeys.includes("lead")) {
    risks.add("Slow response could reduce conversion");
  }
  return [...risks];
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
