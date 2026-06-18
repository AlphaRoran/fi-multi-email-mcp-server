# Security Notes

## Secrets

Do not commit:

- `.env`
- OAuth client secrets
- Local token stores
- Production logs
- Message exports

The default token store is:

```text
~/.fender-industries/email-mcp/tokens.json
```

## Account Selection

Every email action requires an explicit `accountId`. The server does not apply one command across all connected accounts by default.

## Send Policy

The MCP server exposes `send_email`, but production agent workflows should require user approval before sending.

## Destructive Actions

Trash/delete actions should be approval-gated. Gmail trash was not included in the first QA pass because the server does not yet expose untrash.

## OAuth App Distribution

For client-friendly installs, the operator should configure OAuth apps once and deliver environment values privately. Do not put OAuth secrets in the GitHub repository.

