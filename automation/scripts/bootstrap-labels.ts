import { callEmailMcpTool } from "../lib/mcpClient.js";
import { loadProfile, readJson, writeJson, type LabelMapState } from "../lib/profile.js";

type Account = { id: string; provider: "gmail" | "outlook"; email: string };
type Mailbox = { id: string; name: string; type?: string };
type ListMailboxesResponse = { accountId: string; provider: string; mailboxes: Mailbox[] };
type CreateMailboxResponse = { mailbox?: { id?: string; name?: string; displayName?: string } };

const profile = await loadProfile();
const labelMap = await readJson<LabelMapState>(profile.statePaths.labelMap);
const accounts = await callEmailMcpTool<Account[]>("list_accounts");
const configuredAccounts = accounts.filter((account) => profile.accounts.accounts[account.id]);
const report = [];

for (const account of configuredAccounts) {
  try {
    labelMap.accounts[account.id] ||= {};

    if (account.provider === "outlook") {
      for (const label of profile.labels.labels) {
        labelMap.accounts[account.id][label.key] = label.name;
      }
      report.push({
        accountId: account.id,
        provider: account.provider,
        mappedCategories: profile.labels.labels.length,
        created: []
      });
      continue;
    }

    const mailboxes = await callEmailMcpTool<ListMailboxesResponse>("list_mailboxes", { accountId: account.id });
    const byName = new Map((mailboxes.mailboxes || []).map((mailbox) => [mailbox.name, mailbox]));
    const created = [];

    for (const label of profile.labels.labels) {
      let mailbox = byName.get(label.name);
      if (!mailbox) {
        const response = await callEmailMcpTool<CreateMailboxResponse>("create_mailbox", {
          accountId: account.id,
          name: label.name
        });
        mailbox = {
          id: response.mailbox?.id || "",
          name: response.mailbox?.name || response.mailbox?.displayName || label.name
        };
        created.push(label.name);
      }

      if (!mailbox.id) {
        throw new Error(`Mailbox ${label.name} for ${account.id} did not include an id`);
      }
      labelMap.accounts[account.id][label.key] = mailbox.id;
    }

    report.push({
      accountId: account.id,
      provider: account.provider,
      mappedLabels: profile.labels.labels.length,
      created
    });
  } catch (error) {
    report.push({
      accountId: account.id,
      provider: account.provider,
      error: error instanceof Error ? error.message : String(error),
      created: []
    });
  }
}

labelMap.updatedAt = new Date().toISOString();
await writeJson(profile.statePaths.labelMap, labelMap);
console.log(JSON.stringify({ profile: profile.profileDir, report }, null, 2));
