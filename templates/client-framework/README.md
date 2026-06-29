# Client Email Automation Framework

This folder is the reusable starting point for client email automation profiles.

Copy these files into:

```text
profiles/clients/<client-slug>/
```

Rename:

```text
accounts.example.json -> accounts.json
policy.example.json -> policy.json
labels.default.json -> labels.json
```

Then update `accounts.json` with actual account IDs returned by the MCP `list_accounts` tool.

Default behavior is intentionally conservative:

- `mode`: `dry-run`
- no auto-send
- no auto-delete
- no auto-archive
- no auto-unsubscribe
- no auto-label until explicitly enabled

After the first dry-run is reviewed, run:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npx tsx automation/scripts/bootstrap-labels.ts
```

Then switch to `label-only` only when the client approves label behavior.

For the daily operator loop:

```bash
EMAIL_MCP_PROFILE=profiles/clients/<client-slug> npm run automation:operator
```

This writes an approval queue and inbox digest under that profile's `state/` folder. It is safe by default: no sending, deleting, archiving, unsubscribing, or marking read unless future policy modes explicitly allow it.
