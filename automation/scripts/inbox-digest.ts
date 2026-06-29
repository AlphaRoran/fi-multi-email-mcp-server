import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openItems } from "../lib/approvalQueue.js";
import { loadProfile, readJson, type ApprovalQueueItem, type ApprovalQueueState, type ProjectContextState } from "../lib/profile.js";

const profile = await loadProfile();
const queue = await readJson<ApprovalQueueState>(profile.statePaths.approvalQueue);
const projectContext = await readJson<ProjectContextState>(profile.statePaths.projectContext);
const items = openItems(queue);
const digest = renderDigest(items, queue.updatedAt, projectContext);
const digestPath = resolve(profile.profileDir, "state", "inbox-digest.md");

await writeFile(digestPath, digest);
console.log(digest);
console.error(`\nWrote digest: ${digestPath}`);

function renderDigest(items: ApprovalQueueItem[], updatedAt: string | null, projectContext: ProjectContextState): string {
  const groups = {
    "Needs Reply / Decision": items.filter((item) => item.labelKeys.includes("needs_review")),
    "Leads / Clients": items.filter((item) => item.labelKeys.includes("lead") || item.labelKeys.includes("client")),
    "Billing / Scheduling": items.filter((item) => item.labelKeys.includes("billing") || item.labelKeys.includes("scheduling")),
    "Low Priority": items.filter((item) => item.importance === "low")
  };

  const lines = [
    "# Inbox Operator Digest",
    "",
    `Updated: ${updatedAt || "never"}`,
    `Open queue: ${items.length}`,
    `Needs attention: ${items.filter((item) => item.attention).length}`,
    `Project candidates: ${projectContext.items.filter((item) => item.status === "candidate").length}`,
    "",
    "Safety: this digest does not send, delete, archive, unsubscribe, or mark messages read.",
    ""
  ];

  for (const [heading, groupItems] of Object.entries(groups)) {
    lines.push(`## ${heading}`);
    lines.push("");
    if (groupItems.length === 0) {
      lines.push("Nothing open.");
      lines.push("");
      continue;
    }
    for (const item of groupItems.slice(0, 12)) {
      lines.push(`- [${item.attention ? "attention" : item.importance}] ${item.subject}`);
      lines.push(`  From: ${item.from}`);
      lines.push(`  Account: ${item.accountId} (${item.lane})`);
      lines.push(`  Labels: ${item.labelNames.join(", ")}`);
      lines.push(`  Why: ${item.reasons.join("; ")}`);
      lines.push(`  Next: ${item.suggestedActions.join("; ")}`);
      if (item.snippet) {
        lines.push(`  Preview: ${compact(item.snippet)}`);
      }
    }
    lines.push("");
  }

  lines.push("## Project Context / Plan Candidates");
  lines.push("");
  const candidates = projectContext.items.filter((item) => item.status === "candidate").slice(0, 12);
  if (candidates.length === 0) {
    lines.push("Nothing open.");
    lines.push("");
  } else {
    for (const item of candidates) {
      lines.push(`- ${item.projectTitle}`);
      lines.push(`  Source: ${item.sourceFrom} -> ${item.accountId} (${item.lane})`);
      lines.push(`  Goal: ${item.planCandidate.goal}`);
      lines.push(`  Next: ${item.planCandidate.nextActions.join("; ")}`);
      lines.push(`  Questions: ${item.planCandidate.openQuestions.join("; ")}`);
      if (item.planCandidate.risks.length > 0) {
        lines.push(`  Risks: ${item.planCandidate.risks.join("; ")}`);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}
