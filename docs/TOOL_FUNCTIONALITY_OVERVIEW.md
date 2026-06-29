# Multi-Account Email MCP Tool Functionality Overview

This tool is a multi-account email MCP server and automation package. It lets an AI agent connect to multiple Gmail and Outlook accounts, inspect and manage selected mailboxes, classify incoming messages, create safe approval queues, and turn important emails into project-context and planning candidates.

The core idea is one shared email system with one profile per client or operator.

## What This Tool Does

The tool provides:

- One MCP server for Gmail and Outlook.
- Hosted OAuth broker support so clients do not need to handle Google or Microsoft secret keys directly.
- Multi-account authentication through normal provider consent screens.
- Agent-facing tools for reading, searching, sending, labeling, moving, and organizing email.
- Client-specific automation profiles.
- Inbox classification and digest generation.
- Approval queues for messages that need action.
- Project-context candidates and planning output from important emails.
- A scalable client onboarding package with setup questions and JSON/form-driven setup.

## Primary Use Cases

Use this tool when an agent needs to:

- Connect multiple Gmail and Outlook accounts.
- Choose exactly which account to inspect or act from.
- Search and read email across connected accounts.
- Create labels, categories, folders, and mailbox organization systems.
- Send new emails or replies from a selected account.
- Apply labels/categories to messages.
- Build a Superhuman-style inbox management workflow.
- Watch inboxes on a schedule and generate digest summaries.
- Capture project/task context from emails.
- Prepare plans, next actions, open questions, and risks from inbound messages.
- Support multiple clients with separate rules and profiles.

## Architecture

The package has four main parts:

```text
MCP server
  src/server.ts
  src/email.ts
  src/oauth.ts
  src/storage.ts

Hosted OAuth broker
  src/broker.ts
  api/auth/gmail/*
  api/auth/outlook/*

Automation layer
  automation/lib/*
  automation/scripts/*

Client/operator profiles
  profiles/caleb-local/*
  profiles/clients/<client-slug>/*
  templates/client-framework/*
```

The MCP server exposes email tools to an agent. The OAuth broker handles easy browser sign-in. The automation layer runs scheduled inbox management. Profiles define client-specific accounts, policies, labels, and runtime state.

## Authentication

The server supports two authentication models.

### Hosted Broker Mode

This is the client-friendly model.

Google and Microsoft OAuth secrets live on the hosted broker, such as:

```text
https://auth.fenderindustries.com
```

Clients only need the broker URL and public verification key. They do not need to create Google or Microsoft OAuth apps or paste provider secrets into `.env`.

### Direct Local OAuth Mode

This is the fallback model.

The operator or client creates their own Google/Microsoft OAuth apps and adds provider credentials to `.env`.

## Connected Account Model

Every connected mailbox receives an explicit account ID:

```text
gmail:owner@example.com
outlook:owner@example.com
```

Every email action requires an `accountId`. This avoids accidental cross-account actions.

The token store lives outside the repo by default:

```text
~/.fender-industries/email-mcp/tokens.json
```

OAuth tokens and provider secrets should not be committed to GitHub.

## Agent-Facing MCP Tools

The server exposes these MCP tools:

- `list_accounts`: list connected accounts without returning tokens.
- `start_gmail_oauth`: start Gmail OAuth and return the consent URL.
- `start_outlook_oauth`: start Outlook OAuth and return the consent URL.
- `remove_account`: remove a connected account from local token storage.
- `list_mailboxes`: list Gmail labels or Outlook folders.
- `create_mailbox`: create a Gmail label or Outlook folder.
- `rename_mailbox`: rename a Gmail label or Outlook folder.
- `delete_mailbox`: delete a Gmail label or Outlook folder.
- `search_messages`: search messages in one selected account.
- `read_message`: read one selected message.
- `send_email`: send a new message or reply from one selected account.
- `modify_message`: mark read/unread, archive, trash, label, categorize, or move one message.

## Mailbox Organization

The tool can organize mail differently depending on provider.

For Gmail:

- Creates and manages labels.
- Adds and removes label IDs.
- Archives by removing `INBOX`.
- Marks read/unread by modifying the `UNREAD` label.
- Trashes messages through Gmail's trash endpoint.

For Outlook:

- Lists and creates folders.
- Moves messages to folders.
- Applies/removes categories.
- Archives or moves messages to deleted items.
- Marks read/unread with Microsoft Graph.

## Automation Profiles

Profiles keep the shared code separate from each client or operator's rules.

Each profile contains:

```text
accounts.json
policy.json
labels.json
state/
```

`accounts.json` maps connected account IDs to lanes, roles, and priority.

`policy.json` controls automation mode, checking cadence, notification preferences, project context settings, and safety rules.

`labels.json` defines reusable label keys and the display names used in Gmail/Outlook.

`state/` stores generated runtime files and is ignored by Git.

## Safe Runtime Modes

The current safe modes are:

- `dry-run`: scans and classifies messages without changing mailboxes.
- `label-only`: applies labels/categories only when `safeAutomation.allowAutoLabel` is true.

Current automation does not auto-send, auto-delete, auto-archive, auto-unsubscribe, or broadly mark messages read.

Those actions should stay approval-gated until a client-specific policy has been reviewed.

## Inbox Operator

The inbox operator is the Superhuman-style automation loop.

Run:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npm run automation:operator
```

For clients:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:operator
```

The operator:

1. Loads the selected profile.
2. Lists connected accounts.
3. Searches each configured account.
4. Classifies new messages.
5. Optionally applies labels/categories in `label-only` mode.
6. Writes an approval queue.
7. Writes project-context candidates.
8. Renders a digest markdown file.

## Inbox Classification

The classifier looks at subject, sender, snippet, and preview text.

It can identify:

- client/company inbox messages
- billing/payment/invoice items
- scheduling/calendar/call requests
- leads/opportunities/proposals
- newsletters/promotions/subscriptions
- security/operational alerts
- direct asks and urgency signals
- low-priority review-later items

Each classification includes:

- label keys
- label names
- reasons
- suggested actions
- importance level

## Approval Queue

The approval queue is the agent's action list.

It is written to:

```text
profiles/<profile>/state/approval-queue.json
```

Each queue item includes:

- account ID
- provider
- lane
- message ID
- thread ID when available
- subject
- sender
- snippet
- labels
- reasons
- suggested actions
- importance
- attention flag
- status

Manage queue item status:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:queue -- "<accountId:messageId>" done
```

Allowed statuses:

- `open`
- `approved`
- `dismissed`
- `done`

## Digest Generation

The operator renders a readable digest at:

```text
profiles/<profile>/state/inbox-digest.md
```

The digest includes:

- open queue count
- attention count
- project candidate count
- needs reply/decision section
- leads/clients section
- billing/scheduling section
- low-priority section
- project context and planning candidates

This is the easiest artifact to show a client during a demo.

## Project Context And Planning

Important emails can become project-context candidates.

The operator writes these to:

```text
profiles/<profile>/state/project-context.json
```

Each project-context candidate includes:

- source account
- source sender
- source subject
- message/thread ID
- inferred project title
- project key
- context summary
- plan goal
- next actions
- open questions
- risks
- status

This is designed to support workflows where emails become:

- project plans
- tasks
- follow-up queues
- client requests
- operational incidents
- sales opportunities
- billing follow-ups

Manage project-context status:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:project -- "<accountId:threadOrMessageId>" approved
```

Allowed statuses:

- `candidate`
- `approved`
- `imported`
- `dismissed`

By default, project-context items stay local. External writes to Notion, Linear, Asana, ClickUp, or Google Sheets should be added per client and approval-gated.

## Client Setup Package

The package supports a guided client setup flow:

```bash
npm run automation:setup-client
```

The setup wizard asks:

- business/client name
- which email accounts to include
- lane/project area for each account
- inbox priority and role
- where projects/tasks should be stored
- how hands-on the agent should be
- how often the inbox should be checked
- how the client wants notifications
- whether to start in `dry-run` or `label-only`

It creates:

```text
profiles/clients/<client-slug>/accounts.json
profiles/clients/<client-slug>/policy.json
profiles/clients/<client-slug>/labels.json
```

## Form-Driven Client Setup

The same setup can be generated from JSON, which makes it suitable for a website form, Notion intake, or onboarding workflow:

```bash
npm run automation:setup-client -- --from-json /path/to/client-intake.json
```

This allows the business to collect setup answers once, then generate a runnable profile automatically.

## Notification Strategy

The recommended initial model is polling.

Suggested cadence:

- High-touch client: every 2 minutes.
- Balanced client: every 5 minutes.
- Low-touch client: every 15 minutes.

Polling is simpler, reliable, and easy to debug.

Push notification support should be a later production upgrade:

- Gmail: Google Pub/Sub watch per mailbox, renewed before expiration.
- Outlook: Microsoft Graph change notifications, renewed before expiration.

Push is useful for high-volume clients, support inboxes, or SLA-style workflows, but it is not required for the first reliable version.

## Safety Boundaries

The current design is intentionally conservative.

Safe defaults:

- Start every client in `dry-run`.
- Do not send automatically.
- Do not delete automatically.
- Do not archive automatically.
- Do not unsubscribe automatically.
- Do not mark messages read automatically.
- Do not write into external project systems automatically.
- Require explicit account IDs for actions.
- Store tokens outside the repo.

The system can become more autonomous later, but only after each client has approved their rules.

## Current Production Readiness

Working today:

- Multi-account Gmail and Outlook OAuth.
- Hosted OAuth broker model.
- Account listing.
- Mailbox listing and creation.
- Message search and read.
- Sending and replies.
- Message modification.
- Label/category automation.
- Client profiles.
- Setup wizard.
- JSON intake setup.
- Inbox operator loop.
- Approval queue.
- Digest generation.
- Project-context candidates.
- Local project planning output.

Still recommended before broad client rollout:

- Finish Google app verification for production Gmail access.
- Add external project-system writers per client destination.
- Add explicit approval workflows for sending and destructive actions.
- Add a scheduler or hosted worker for recurring runs.
- Add optional Gmail Pub/Sub and Outlook Graph webhooks for clients that need instant triggers.
- Add richer client-specific classification rules over time.

## Useful Commands

Install:

```bash
npm install
```

Check readiness:

```bash
npm run doctor
```

Run MCP server:

```bash
npm run mcp:stdio
```

Start client setup:

```bash
npm run automation:setup-client
```

Run inbox operator:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:operator
```

Bootstrap labels before `label-only`:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:bootstrap-labels
```

Render digest only:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:digest
```

Update queue item status:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:queue -- "<accountId:messageId>" done
```

Update project-context status:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:project -- "<accountId:threadOrMessageId>" approved
```

Build:

```bash
npm run build
```

## Summary

This tool is not just an email connector. It is a foundation for a client-scalable inbox operations agent.

At the MCP layer, it gives the agent controlled access to multiple Gmail and Outlook accounts.

At the automation layer, it classifies email, produces safe queues, and prepares digest summaries.

At the planning layer, it turns important emails into project-context candidates with goals, next actions, open questions, and risks.

At the client package layer, it lets each client have their own accounts, rules, labels, cadence, notification preferences, and project workflow.
