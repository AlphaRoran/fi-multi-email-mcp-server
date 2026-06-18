# Client Install Guide

This guide is for installing the multi-account email MCP server on a client machine.

## What The Client Needs

- Node.js 20 or newer.
- A private `.env` file supplied by the operator or created by the client.
- An MCP host that can run stdio MCP servers.

Mailbox users do not need API keys. They connect accounts by signing in to Gmail or Outlook and granting permissions in the browser.

## Install

```bash
git clone <repo-url>
cd email-mcp-server
npm install
cp .env.example .env
```

Fill `.env` with the OAuth app values supplied privately:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
```

Gmail-only installs only need the Google values. Outlook-only installs only need the Microsoft values.

## Verify Setup

```bash
npm run doctor
npm run build
```

Expected for Gmail-only:

```text
provider Gmail: ready
provider Outlook: not configured
```

## Register With Codex

```bash
codex mcp add multi-account-email --env-file /absolute/path/to/.env -- npm --prefix /absolute/path/to/email-mcp-server run mcp:stdio
```

Restart the MCP host after registration if it does not immediately show the new tools.

## Connect A Gmail Account

1. In the MCP host, call `start_gmail_oauth`.
2. The server opens the Google consent screen.
3. Sign in to the Gmail account.
4. Approve the requested permissions.
5. Call `list_accounts`.
6. Confirm an account like `gmail:name@example.com` appears.

## Connect Another Gmail Account

Call `start_gmail_oauth` again and choose a different Google account. Each connected account receives its own `accountId`.

## Runtime Token Location

Connected mailbox tokens are stored locally at:

```text
~/.fender-industries/email-mcp/tokens.json
```

Do not commit this file to GitHub or share it with another client.

## Common Issues

### Access blocked: app has not completed Google verification

The Google OAuth app is still in testing mode and the signed-in user is not an approved test user. Add the email address in Google Auth Platform > Audience > Test users, or complete Google verification.

### Redirect URI mismatch

Make sure the OAuth client has this redirect URI:

```text
http://127.0.0.1:8741/oauth/callback
```

### MCP host cannot see the server

Run `npm run doctor`, confirm `.env` exists, then restart the MCP host.

