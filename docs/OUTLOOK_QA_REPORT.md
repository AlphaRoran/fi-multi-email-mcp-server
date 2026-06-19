# Outlook QA Report

Date: June 18, 2026

## Environment

- Project: Multi-Account Email MCP Server
- Provider: Outlook / Microsoft Graph
- OAuth mode: local broker development flow
- Connected account:
  - `outlook:calebefender@outlook.com`

## Results

| Capability | Result | Evidence |
| --- | --- | --- |
| OAuth connect | Pass | `list_accounts` returned `outlook:calebefender@outlook.com`. |
| List folders | Pass | `list_mailboxes` returned Archive, Deleted Items, Drafts, Inbox, Junk Email, Outbox, and Sent Items. |
| Search messages | Pass | `search_messages` returned recent Outlook messages. |
| Read message | Pass | `read_message` returned metadata and HTML body for a selected Microsoft account email. |
| Send email | Pass | Sent QA email from `outlook:calebefender@outlook.com` to `fenderindustries@gmail.com`. |
| Sent-mail verification | Pass | Outlook search found the QA email in the sender account. |
| Create folder | Pass | Temporary Outlook folder created. |
| Rename folder | Pass | Temporary Outlook folder renamed. |
| Add category | Pass | Added `MCP QA Category` to the QA email. |
| Remove category | Pass | Removed `MCP QA Category`; final categories were empty. |
| Move message | Pass | Moved QA email into temporary Outlook folder. |
| Restore moved message | Pass | Moved QA email back to Sent Items. |
| Delete folder | Pass | Temporary Outlook folder deleted. |
| Mark read/unread | Pass | QA email toggled unread and restored to read. |
| Trash | Not tested | Destructive; current QA avoided moving mail to Deleted Items. |

## QA Email

Subject:

```text
MCP Outlook QA send test 2026-06-18
```

Final Outlook-side state:

- Account: `outlook:calebefender@outlook.com`
- Folder: Sent Items
- Read state: read
- Categories: none

## Notes

- Microsoft Graph changes message IDs when messages are moved between folders. The MCP server now returns the moved message object so the agent can use the replacement ID for follow-up actions.
- Gmail did not immediately show the incoming copy from Outlook during QA, but Outlook confirmed the send in Sent Items.
- Some Microsoft 365 tenants may still require admin approval even though the app is configured for multitenant and personal Microsoft accounts.

## Follow-Up

- Add a non-destructive trash/restore QA path before testing destructive Outlook delete flows.
- Configure hosted broker production environment on Vercel.
- Add the hosted broker redirect URI to the Microsoft app once the final Vercel/custom domain is selected.

