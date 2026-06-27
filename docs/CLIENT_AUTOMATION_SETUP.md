# Client Automation Setup

Use the client framework when setting up a repeatable inbox-management agent for a client.

## 1. Connect Accounts

Use the Email MCP OAuth tools:

```text
start_gmail_oauth
start_outlook_oauth
list_accounts
```

Record the returned account IDs.

## 2. Create The Client Profile

Copy:

```text
templates/client-framework/
```

to:

```text
profiles/clients/<client-slug>/
```

Rename the copied files:

```text
accounts.example.json -> accounts.json
policy.example.json -> policy.json
labels.default.json -> labels.json
```

## 3. Fill Account Roles

Edit `accounts.json` with the connected account IDs and roles:

```text
owner-primary
sales
support
billing
operations
personal
```

## 4. Run Dry-Run

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npx tsx automation/scripts/primary-watchdog.ts
```

Review the report before making any mailbox changes.

## 5. Bootstrap Labels

Only after the labels are approved:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npx tsx automation/scripts/bootstrap-labels.ts
```

## 6. Enable Label-Only

In `policy.json`, set:

```json
{
  "mode": "label-only",
  "safeAutomation": {
    "allowAutoLabel": true
  }
}
```

Leave all other automation gates disabled until explicitly approved.

## Approval Gates

Always require approval for:

- sending email
- deleting or trashing mail
- unsubscribing
- broad archive rules
- client-impacting communications
- OAuth or credential changes
