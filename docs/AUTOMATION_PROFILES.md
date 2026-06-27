# Automation Profiles

Automation profiles keep the shared Email MCP core separate from operator-specific or client-specific inbox rules.

## Active Profile

Scripts read `EMAIL_MCP_PROFILE`.

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npx tsx automation/scripts/primary-watchdog.ts
```

If `EMAIL_MCP_PROFILE` is omitted, scripts default to:

```text
profiles/caleb-local
```

## Profile Files

Each profile contains:

```text
accounts.json
policy.json
labels.json
state/
```

`accounts.json` maps connected MCP account IDs to lanes, roles, and priority.

`policy.json` controls watchdog queries and safe automation settings.

`labels.json` defines logical label keys and user-facing label names.

`state/` contains runtime files such as processed messages and label maps. State files are gitignored.

## Current Safe Modes

`dry-run` scans and classifies messages without modifying mailboxes.

`label-only` applies configured labels/categories only when `safeAutomation.allowAutoLabel` is true.

No current mode sends, deletes, unsubscribes, or broadly archives messages.

## Bootstrap Labels

Before `label-only`, run:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npx tsx automation/scripts/bootstrap-labels.ts
```

For Gmail, this creates missing Gmail labels and stores label IDs in the profile state.

For Outlook, this maps label names to Outlook categories. It does not create folders.
