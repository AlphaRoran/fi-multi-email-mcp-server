import { loadProfile, readJson, writeJson, type ProjectContextItem, type ProjectContextState } from "../lib/profile.js";

const [, , key, status] = process.argv;
const allowed = new Set<ProjectContextItem["status"]>(["candidate", "approved", "imported", "dismissed"]);

if (!key || !status || !allowed.has(status as ProjectContextItem["status"])) {
  console.error(
    "Usage: EMAIL_MCP_PROFILE=profiles/clients/acme npm run automation:project -- <accountId:threadOrMessageId> <candidate|approved|imported|dismissed>"
  );
  process.exit(1);
}

const profile = await loadProfile();
const state = await readJson<ProjectContextState>(profile.statePaths.projectContext);
const item = state.items.find((candidate) => candidate.key === key);

if (!item) {
  console.error(`Project context item not found: ${key}`);
  process.exit(1);
}

item.status = status as ProjectContextItem["status"];
item.updatedAt = new Date().toISOString();
state.updatedAt = item.updatedAt;
await writeJson(profile.statePaths.projectContext, state);
console.log(JSON.stringify({ updated: key, status: item.status }, null, 2));
