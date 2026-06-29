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

## Inbox Operator

Run the operator loop:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npm run automation:operator
```

This scans the configured accounts, classifies new messages, writes notifiable items into:

```text
profiles/caleb-local/state/approval-queue.json
```

It also renders a human-readable digest at:

```text
profiles/caleb-local/state/inbox-digest.md
```

Important messages can also create project-context candidates at:

```text
profiles/caleb-local/state/project-context.json
```

These candidates include source email context, inferred project title, goal, next actions, open questions, and risks. They are local-only until an approved external writer is configured for the profile's project system.

For a near-real-time inbox operator, run the command every 2-5 minutes with launchd, cron, or your host scheduler. True push notifications should be added later with Gmail Pub/Sub watches and Microsoft Graph change notification subscriptions.

Manage queue items after review:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npm run automation:queue -- "gmail:caleb@example.com:MESSAGE_ID" done
```

Allowed statuses are `open`, `approved`, `dismissed`, and `done`.

Manage project-context candidates after review:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npm run automation:project -- "gmail:caleb@example.com:THREAD_OR_MESSAGE_ID" approved
```

Allowed statuses are `candidate`, `approved`, `imported`, and `dismissed`.

## Bootstrap Labels

Before `label-only`, run:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npx tsx automation/scripts/bootstrap-labels.ts
```

For Gmail, this creates missing Gmail labels and stores label IDs in the profile state.

For Outlook, this maps label names to Outlook categories. It does not create folders.
