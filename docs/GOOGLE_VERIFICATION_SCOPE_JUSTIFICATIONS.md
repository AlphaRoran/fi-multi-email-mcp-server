# Google Verification Scope Justifications

These notes are drafted for the Google OAuth verification submission.

## App Summary

The Multi-Account Email MCP Server lets an authorized AI agent help a user manage mailboxes that the user explicitly connects. The server runs locally or in a client-controlled environment. It supports searching, reading, organizing, labeling, archiving, and sending email only for accounts the user signs into and authorizes through Google OAuth.

The app does not scrape Gmail credentials. It uses Google OAuth and stores refresh tokens locally in the configured token store.

## Requested Scopes

### `https://www.googleapis.com/auth/userinfo.email`

Purpose: identify the Google account that completed OAuth and create a stable `accountId` such as `gmail:user@example.com`.

User value: lets the agent distinguish between multiple connected Gmail accounts so it can act on one selected account at a time.

Data use: email address is stored as account metadata in the local token store. It is not sold or shared.

### `https://www.googleapis.com/auth/gmail.modify`

Purpose: let the agent read and organize Gmail messages on behalf of the signed-in user.

Required features:

- Search messages.
- Read selected messages.
- Mark messages read or unread.
- Archive messages.
- Move messages to trash when explicitly instructed.
- Apply and remove labels.
- Create, rename, and delete Gmail labels.

Why narrower scopes are not enough: label application, read/unread state changes, archive actions, and message organization require modify access. The tool is designed for mailbox management, not read-only reporting.

Data use: message metadata and selected message bodies are returned to the MCP host when requested by the user or agent workflow. The server itself does not create a separate message-body database. Runtime OAuth tokens are stored locally.

### `https://www.googleapis.com/auth/gmail.send`

Purpose: send new email or replies from a user-selected connected Gmail account.

User value: lets the agent draft and send email through the account the user authorized.

Data use: the server sends only the message content supplied in the MCP tool call. Sends should be approval-gated by the surrounding agent workflow.

## Data Handling

- OAuth tokens are stored locally at `~/.fender-industries/email-mcp/tokens.json` unless overridden.
- Tokens are not committed to the repository.
- The app does not require users to share Google passwords.
- The app does not sell, rent, or transfer Gmail data for advertising.
- The app does not use Gmail data to train generalized AI models.
- User or client operators can revoke access from the Google Account permissions page or remove an account with the MCP `remove_account` tool.

## Human Review Demo Script

The verification demo should show:

1. Starting the MCP server.
2. Calling `start_gmail_oauth`.
3. Signing into Google and approving Gmail permissions.
4. Calling `list_accounts` to show the connected account.
5. Calling `search_messages` to search one selected account.
6. Calling `read_message` to read one selected message.
7. Calling `create_mailbox` to create a label.
8. Calling `modify_message` to apply and remove the label.
9. Calling `send_email` after explicit approval.
10. Calling `remove_account` or showing Google access revocation instructions.

