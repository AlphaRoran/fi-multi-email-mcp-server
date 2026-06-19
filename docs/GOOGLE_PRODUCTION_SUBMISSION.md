# Google Production Submission Checklist

Use this checklist when moving the Google OAuth app from testing to production.

## Domain Values

Authorized domain:

```text
fenderindustries.com
```

App homepage:

```text
https://auth.fenderindustries.com/
```

Privacy policy:

```text
https://auth.fenderindustries.com/privacy
```

Terms of service:

```text
https://auth.fenderindustries.com/terms
```

Authorized redirect URI for the Google OAuth web client:

```text
https://auth.fenderindustries.com/auth/gmail/callback
```

## OAuth Scopes

```text
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.send
```

## Scope Justification Summary

`userinfo.email` identifies which Gmail account completed OAuth so the MCP server can create an account ID like
`gmail:user@example.com`.

`gmail.modify` is required for mailbox management features: search, read selected messages, mark read/unread, archive,
trash, and apply or remove labels.

`gmail.send` is required to send email from the user-selected connected Gmail account.

## Production Steps

1. In Cloudflare DNS, create `A auth.fenderindustries.com 76.76.21.21`.
2. Wait until `https://auth.fenderindustries.com/api/health` returns `{"ok":true}`.
3. In Google Auth Platform > Branding, set the app domain URLs above.
4. In Google Auth Platform > Branding or Audience, add `fenderindustries.com` as an authorized domain if it is not already present.
5. In Google Auth Platform > Data Access, confirm the three scopes above are present.
6. In Google Auth Platform > Clients, open the web client and add the redirect URI above.
7. In Google Verification Center, submit for verification.
8. Provide the demo video using `docs/DEMO_VIDEO_SCRIPT.md`.
9. Provide the detailed scope explanations from `docs/GOOGLE_VERIFICATION_SCOPE_JUSTIFICATIONS.md`.

## Demo Video Must Show

1. Starting the MCP server.
2. Calling `start_gmail_oauth`.
3. Signing in through Google OAuth.
4. Granting the requested Gmail permissions.
5. Returning to the local MCP callback.
6. Calling `list_accounts` to show the connected account.
7. Searching and reading one selected message.
8. Creating a label.
9. Applying and removing the label from the selected message.
10. Sending an email only after explicit approval.
11. Removing the connected account or showing where access can be revoked.

## Notes

Gmail mailbox scopes are restricted. Google can require verification and may require a security assessment depending on
the exact production use and data handling. The broker is designed not to retain mailbox data; tokens are handed back to
the local MCP token store after consent.
