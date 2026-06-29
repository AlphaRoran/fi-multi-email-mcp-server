import { loadProfile, readJson, writeJson, type ApprovalQueueState, type ApprovalQueueItem } from "../lib/profile.js";

const [, , key, status] = process.argv;
const allowed = new Set<ApprovalQueueItem["status"]>(["open", "approved", "dismissed", "done"]);

if (!key || !status || !allowed.has(status as ApprovalQueueItem["status"])) {
  console.error("Usage: EMAIL_MCP_PROFILE=profiles/caleb-local npm run automation:queue -- <accountId:messageId> <open|approved|dismissed|done>");
  process.exit(1);
}

const profile = await loadProfile();
const queue = await readJson<ApprovalQueueState>(profile.statePaths.approvalQueue);
const item = queue.items.find((candidate) => candidate.key === key);

if (!item) {
  console.error(`Queue item not found: ${key}`);
  process.exit(1);
}

item.status = status as ApprovalQueueItem["status"];
item.lastSeenAt = new Date().toISOString();
queue.updatedAt = item.lastSeenAt;
await writeJson(profile.statePaths.approvalQueue, queue);
console.log(JSON.stringify({ updated: key, status: item.status }, null, 2));
