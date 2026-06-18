# Privacy Policy Draft

Last updated: June 18, 2026

This draft is intended to be adapted for the operator or client publishing the OAuth app.

## Overview

Multi-Account Email MCP Server helps users connect Gmail and Outlook accounts to an MCP-compatible AI agent. The tool can read, search, organize, label, archive, and send email only after the user signs in through the provider's OAuth consent screen.

## Information We Access

Depending on the connected provider and permissions granted, the tool may access:

- Email account address.
- Email message metadata such as sender, recipient, subject, labels, folders, dates, and message IDs.
- Email message body content when a user or agent requests a selected message.
- Mailbox labels or folders.
- Drafted outbound message content supplied to the send tool.

## How Information Is Used

Information is used to provide mailbox management features requested by the user or the user's authorized agent workflow, including:

- Listing connected accounts.
- Searching and reading selected messages.
- Organizing messages with labels, folders, read/unread state, archive, or trash actions.
- Creating, renaming, and deleting labels or folders.
- Sending email from an authorized account.

We do not sell email data. We do not use email data for advertising. We do not use email data to train generalized AI models.

## Token Storage

OAuth tokens are stored locally by default at:

```text
~/.fender-industries/email-mcp/tokens.json
```

The token store path can be overridden by configuration. Tokens should not be committed to source control or shared publicly.

## Data Sharing

The tool returns requested email data to the configured MCP host so the authorized agent can perform the requested task. The tool does not intentionally transmit mailbox data to unrelated third parties.

If a client hosts the MCP server in its own environment, that client is responsible for its hosting, access controls, and retention policies.

## Data Retention

The server does not maintain a separate email archive by default. OAuth tokens remain on the local machine until removed by the user or operator.

Users can remove an account by:

- Calling the MCP `remove_account` tool.
- Deleting the local token store.
- Revoking app access in Google Account or Microsoft account security settings.

## Security

The tool uses OAuth rather than collecting account passwords. Access is scoped to permissions approved by the user. Operators should protect `.env` files, OAuth secrets, and local token stores.

## Contact

Support contact: [add support email before publishing]

