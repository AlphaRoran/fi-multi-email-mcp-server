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

Preferred broker-based installs only need the broker URL and public key:

```bash
EMAIL_MCP_AUTH_BASE_URL=https://auth.fenderindustries.com
EMAIL_MCP_BROKER_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

No Google or Microsoft provider secrets are needed on the client machine.

For the current Vercel broker, use:

```bash
EMAIL_MCP_AUTH_BASE_URL=https://auth.fenderindustries.com
```

Direct local OAuth fallback can still use provider values:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
```

Gmail-only direct installs only need the Google values. Outlook-only direct installs only need the Microsoft values.

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

## Connect Outlook From Terminal

On Windows PowerShell:

```powershell
npm run auth:outlook
```

Leave the terminal open until the browser says the account is connected.

If the browser does not open, copy the printed `Auth URL` into the browser manually.

Gmail can be connected the same way:

```powershell
npm run auth:gmail
```

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

For hosted broker installs, make sure the OAuth clients have these redirect URIs:

```text
https://auth.fenderindustries.com/auth/gmail/callback
https://auth.fenderindustries.com/auth/outlook/callback
```

For direct local OAuth fallback, make sure the OAuth client has this redirect URI:

```text
http://127.0.0.1:8741/oauth/callback
```

### Port 8741 is already in use

This means an old OAuth callback/server process is still running.

On Windows PowerShell:

```powershell
netstat -ano | findstr :8741
taskkill /PID <PID_FROM_NETSTAT> /F
```

Then rerun:

```powershell
npm run auth:outlook
```

### Microsoft scope or consent error

Confirm the Microsoft app registration allows the account type being used and has delegated permissions for:

```text
openid
profile
email
offline_access
User.Read
Mail.ReadWrite
Mail.Send
```

### MCP host cannot see the server

Run `npm run doctor`, confirm `.env` exists, then restart the MCP host.
