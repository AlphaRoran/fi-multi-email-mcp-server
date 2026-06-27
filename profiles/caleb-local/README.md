# Caleb Local Email Automation Profile

This profile is Caleb-specific. It maps Caleb's connected Gmail and Outlook accounts into lanes used by the automation scripts.

Run from the repo root:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npx tsx automation/scripts/primary-watchdog.ts
```

The default policy is `dry-run`. Do not enable `label-only` until labels have been bootstrapped:

```bash
EMAIL_MCP_PROFILE=profiles/caleb-local npx tsx automation/scripts/bootstrap-labels.ts
```

Runtime state lives in `profiles/caleb-local/state/` and is intentionally gitignored.
