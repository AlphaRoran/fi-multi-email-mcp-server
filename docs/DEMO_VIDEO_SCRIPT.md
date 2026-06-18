# Demo Video Script

Use this script for Google OAuth verification or client onboarding.

## Goal

Show that the app only acts on accounts the user explicitly connects, and that Gmail data is used for mailbox management features.

## Script

1. Show the project folder and start the MCP server.

```bash
npm run doctor
npm run mcp:stdio
```

2. In the MCP host, call `start_gmail_oauth`.

Narration: "The agent requests Gmail authorization. The browser opens Google's OAuth consent screen."

3. Sign in with a test Gmail account and approve permissions.

Narration: "The user signs in directly with Google. The app never sees the user's password."

4. Call `list_accounts`.

Narration: "The connected account appears with a stable account ID. Every mailbox action requires this account ID."

5. Call `search_messages` with `maxResults: 3`.

Narration: "The agent can search only inside the selected connected mailbox."

6. Call `read_message` for one selected message.

Narration: "The agent can read a specific message when needed for the user's task."

7. Call `create_mailbox`.

Narration: "The agent can create a Gmail label for organization."

8. Call `modify_message` with `addLabels`, then call it again with `removeLabels`.

Narration: "The agent can tag and untag messages using Gmail labels."

9. Call `rename_mailbox`, then `delete_mailbox` for the temporary label.

Narration: "The agent can manage labels and clean up temporary organization structures."

10. Show a send action only after explicit approval.

Narration: "Email sending is available, but production workflows should require user approval before sends."

11. Show account removal or revocation path.

Narration: "The user can remove the local account token or revoke app access from their Google Account."

## Screen Recording Notes

- Do not show `.env` values.
- Do not show OAuth client secrets.
- Use a test mailbox with harmless messages.
- Blur unrelated personal email subjects if needed.

