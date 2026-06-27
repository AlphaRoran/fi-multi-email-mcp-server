# Client Email Automation Onboarding

Use this checklist when setting up a new client profile.

## Required Inputs

- Client name.
- Connected email account IDs from `list_accounts`.
- Role for each account, such as owner, sales, support, billing, operations, or personal.
- Safety mode for initial rollout. Default is `dry-run`.
- Approval rule for sending email. Default is explicit human approval.

## Setup Steps

1. Connect all client accounts with `start_gmail_oauth` or `start_outlook_oauth`.
2. Run `list_accounts`.
3. Copy this template into `profiles/clients/<client-slug>/`.
4. Replace example account IDs in `accounts.json`.
5. Keep `policy.json` in `dry-run` until a dry-run report has been reviewed.
6. Run the watchdog:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npx tsx automation/scripts/primary-watchdog.ts
```

7. Review classifications with the client.
8. Run label bootstrap only after labels are approved:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npx tsx automation/scripts/bootstrap-labels.ts
```

9. Enable `label-only` only after confirming labels and account roles are correct.

## Safety Rules

- No sending without approval.
- No deleting without approval.
- No unsubscribing without approval.
- No broad archiving without approval.
- Keep runtime state out of Git.
