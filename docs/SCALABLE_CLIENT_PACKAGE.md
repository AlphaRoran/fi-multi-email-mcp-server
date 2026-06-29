# Scalable Client Email Operator Package

The service is structured as one shared MCP server plus one profile per client.

## Package Shape

```text
shared MCP server
  Gmail/Outlook OAuth
  account tools
  label/folder tools
  message search/read/send/modify tools

profiles/clients/<client-slug>
  accounts.json
  policy.json
  labels.json
  state/
```

Credentials and OAuth tokens do not live in client profiles. Profiles only store routing, policy, labels, and runtime queue state.

## Client Setup Wizard

Run:

```bash
npm run automation:setup-client
```

The wizard asks:

- business/client name
- which connected email accounts to include
- lane/project area for each account
- inbox priority and role
- where tasks/projects should be stored
- how hands-on the agent should be
- how often to check the inbox
- how the client wants to be notified
- whether to start in dry-run or label-only mode

It creates:

```text
profiles/clients/<client-slug>/accounts.json
profiles/clients/<client-slug>/policy.json
profiles/clients/<client-slug>/labels.json
```

The same setup can be generated from a form or intake JSON:

```bash
npm run automation:setup-client -- --from-json /path/to/client-intake.json
```

Required JSON shape:

```json
{
  "clientName": "Example Client",
  "clientSlug": "example-client",
  "accounts": {
    "gmail:owner@example.com": {
      "lane": "owner",
      "role": "owner-primary",
      "priority": "high",
      "notes": "Primary inbox"
    }
  },
  "operatingStyle": "balanced",
  "projectSystem": "Notion",
  "notificationPreference": "attention-only",
  "checkCadenceMinutes": 5,
  "escalationChannels": ["digest"],
  "mode": "dry-run",
  "allowAutoLabel": false,
  "notes": "Client-specific rules."
}
```

## Recommended Runtime Modes

Start every client in `dry-run`.

Use this for the first review:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:operator
```

After the client approves the label model:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:bootstrap-labels
```

Then change `policy.json` to:

```json
{
  "mode": "label-only",
  "safeAutomation": {
    "allowAutoLabel": true
  }
}
```

Keep sending, deleting, archiving, and unsubscribing approval-gated until there is a reviewed client-specific policy.

## Notification Strategy

For the first production version, use polling.

Recommended cadence:

- high-touch client: every 2 minutes
- balanced client: every 5 minutes
- low-touch client: every 15 minutes

Polling is simpler, easier to debug, and does not require webhook hosting per client.

Add push notifications later when needed:

- Gmail: Google Pub/Sub watch on each mailbox, renewed before expiration.
- Outlook: Microsoft Graph change notifications, renewed before expiration.

Push is best for clients who need immediate response, high-volume inboxes, or SLA-style support. It is not required for a reliable inbox operator demo.

## Guiding Questions

Use these during onboarding:

1. Which email accounts should the agent manage?
2. What is each inbox for: owner, sales, support, billing, scheduling, operations?
3. Where should tasks/projects be created: Notion, Linear, Asana, ClickUp, Google Sheets, or something else?
4. How involved should the agent be: label only, draft replies, propose archive, or manage the inbox with approvals?
5. How often should it check email?
6. What should trigger an immediate notification?
7. What should never be touched without approval?
8. Who approves replies or risky actions?
9. Are there VIP senders, client domains, or deal/project keywords?
10. Are there compliance, legal, finance, or HR messages that need special rules?
