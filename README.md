# Multi-Account Email MCP Server

One MCP server for authenticating multiple Gmail and Outlook accounts, then letting an AI agent read, search, manage, and send mail through a selected account.

The server operator configures provider OAuth apps once. After that, adding another mailbox is a consent-screen flow: call the MCP tool, sign in in the browser window, grant permissions, and the callback stores the account token locally.

## Is This Clone-And-Run?

Mostly, but not completely zero-config.

After a client downloads the repo, they can run the MCP server with normal Node.js commands. They should not need API keys for each mailbox they connect. Each mailbox user just signs in and grants permission.

However, Gmail and Outlook still require an OAuth application to exist. There are two ways to handle that:

- Recommended client-friendly path: run the hosted OAuth broker so Google/Microsoft OAuth secrets stay on your server. Clients receive only the broker URL and public verification key.
- Self-hosted path: the client creates their own Google/Microsoft OAuth apps and fills in `.env`.

Do not commit production OAuth secrets or refresh tokens to GitHub. Runtime mailbox tokens stay outside the repo in `~/.fender-industries/email-mcp/tokens.json`.

## Safety Model

- Credentials and OAuth tokens are not stored in this repo.
- Runtime tokens default to `~/.fender-industries/email-mcp/tokens.json`.
- Every mailbox action requires an explicit `accountId`.
- The server does not broadcast an action across all accounts.
- Sends and destructive mail changes should still be approval-gated by the agent workflow.

## Setup

For the provider setup walkthrough, see [OAUTH_SETUP.md](./OAUTH_SETUP.md).
For the hosted broker architecture, see [docs/HOSTED_OAUTH_BROKER.md](./docs/HOSTED_OAUTH_BROKER.md).
For client installation, see [docs/CLIENT_INSTALL.md](./docs/CLIENT_INSTALL.md).
For Google verification prep, see [docs/GOOGLE_VERIFICATION_SCOPE_JUSTIFICATIONS.md](./docs/GOOGLE_VERIFICATION_SCOPE_JUSTIFICATIONS.md).

```bash
npm install
cp .env.example .env
```

For the client-friendly hosted broker setup, clients only need:

```bash
EMAIL_MCP_AUTH_BASE_URL=https://auth.fenderindustries.com
EMAIL_MCP_BROKER_PUBLIC_KEY=
```

Google and Microsoft OAuth secrets stay in the hosted broker environment on Vercel, not on the client machine.

For direct local OAuth fallback, fill in the OAuth app values once for the providers you want:

- Gmail: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Outlook/Microsoft Graph: `MICROSOFT_CLIENT_ID`, optional `MICROSOFT_CLIENT_SECRET`, optional `MICROSOFT_TENANT_ID`

For hosted broker mode, configure these redirect URIs in the provider OAuth apps:

```text
https://auth.fenderindustries.com/auth/gmail/callback
https://auth.fenderindustries.com/auth/outlook/callback
```

For direct local OAuth fallback, configure this redirect URI in the OAuth app:

```text
http://127.0.0.1:8741/oauth/callback
```

Build and run:

```bash
npm start
```

Check readiness:

```bash
npm run doctor
```

Example Codex MCP registration:

```bash
codex mcp add multi-account-email --env-file /absolute/path/to/.env -- npm --prefix /absolute/path/to/email-mcp-server run mcp:stdio
```

## Tools

- `list_accounts` - list authenticated accounts and granted scopes.
- `start_gmail_oauth` - starts Gmail OAuth and returns an auth URL.
- `start_outlook_oauth` - starts Outlook OAuth and returns an auth URL.
- `remove_account` - remove one authenticated account from local token storage.
- `list_mailboxes` - list Gmail labels or Outlook folders for one account.
- `create_mailbox` - create a Gmail label or Outlook folder.
- `rename_mailbox` - rename a Gmail label or Outlook folder.
- `delete_mailbox` - delete a Gmail label or Outlook folder.
- `search_messages` - search one account.
- `read_message` - read one message from one account.
- `send_email` - send a new message or reply from one account.
- `modify_message` - mark read/unread, archive, delete/trash, label, categorize, or move a message.

## OAuth Flow

1. Start the MCP server.
2. Call `start_gmail_oauth` or `start_outlook_oauth`.
3. The server opens the provider consent screen by default.
4. Sign in and approve the requested scopes.
5. The local callback stores the account tokens.
6. Call `list_accounts` and use the returned `accountId` for mail actions.

The auth tools also return `authUrl`, `redirectUri`, `state`, `scopes`, and `openedBrowser`. If the browser cannot be opened automatically, open `authUrl` manually. To suppress browser opening, pass:

```json
{
  "openBrowser": false
}
```

## Provider Scopes

Gmail:

- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/userinfo.email`

Outlook:

- `offline_access`
- `User.Read`
- `Mail.ReadWrite`
- `Mail.Send`

## Launch Docs

- [Client install guide](./docs/CLIENT_INSTALL.md)
- [Hosted OAuth broker](./docs/HOSTED_OAUTH_BROKER.md)
- [Google verification scope justifications](./docs/GOOGLE_VERIFICATION_SCOPE_JUSTIFICATIONS.md)
- [Privacy policy draft](./docs/PRIVACY_POLICY_DRAFT.md)
- [Demo video script](./docs/DEMO_VIDEO_SCRIPT.md)
- [Gmail QA report](./docs/GMAIL_QA_REPORT.md)
- [Outlook QA report](./docs/OUTLOOK_QA_REPORT.md)
- [Security notes](./docs/SECURITY_NOTES.md)
