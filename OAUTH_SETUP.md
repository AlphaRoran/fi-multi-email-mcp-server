# OAuth App Setup

This MCP server supports two onboarding levels:

1. Local/testing setup: you create OAuth apps and add yourself or a client as a test user.
2. Client-ready setup: you publish or verify the OAuth apps so outside users can consent without test-user restrictions.

Direct local OAuth uses this local redirect URI:

```text
http://127.0.0.1:8741/oauth/callback
```

Hosted broker OAuth uses public broker redirect URIs:

```text
https://auth.example.com/auth/gmail/callback
https://auth.example.com/auth/outlook/callback
```

## Google Gmail

### 1. Create a Google Cloud project

1. Open Google Cloud Console.
2. Create a new project for the email MCP server.
3. Enable the Gmail API for the project.

### 2. Configure the Google Auth platform

1. Go to Google Auth platform > Branding.
2. Enter:
   - App name
   - User support email
   - Developer contact email
3. Choose audience:
   - Internal: only users in your Google Workspace organization.
   - External: Gmail users outside your organization.
4. Add test users if the app is External and still in testing.

### 3. Add Gmail scopes

This server currently requests:

```text
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/userinfo.email
```

`gmail.modify` gives broad read/write mailbox access and is a restricted Gmail scope. Expect Google OAuth verification before using this broadly with outside clients.

### 4. Create an OAuth client

Recommended for local MCP use:

1. Go to Credentials.
2. Create OAuth client ID.
3. Choose Desktop app if you want local installed-app behavior.
4. Use Web application only if you want to manage an explicit loopback redirect URI.
5. If using Web application for direct local OAuth, add:

```text
http://127.0.0.1:8741/oauth/callback
```

For hosted broker mode, add the broker callback instead:

```text
https://auth.example.com/auth/gmail/callback
```

6. Copy the client ID and client secret into `.env`:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 5. Test Gmail auth

1. Start the MCP server.
2. Call `start_gmail_oauth`.
3. Sign in and consent in the browser window.
4. Call `list_accounts`.
5. Confirm a `gmail:<email>` account appears.

### 6. Prepare Google verification

For client/public use, prepare:

- Public app name and support email.
- App logo.
- Privacy policy URL.
- Terms of service URL if applicable.
- Homepage or product page URL.
- Demo video showing OAuth consent and exactly how Gmail data is used.
- Written explanation for each scope.
- Data retention/deletion explanation.
- Security controls and data handling notes.

Because `gmail.modify` is restricted, Google can require restricted scope verification and, if restricted data is stored on or transmitted through servers, a security assessment. For this local MCP server, document that mailbox tokens are stored locally and that the app does not persist message bodies unless the agent/user separately saves them.

## Microsoft Outlook

### 1. Register a Microsoft Entra app

1. Open Microsoft Entra admin center.
2. Go to App registrations.
3. Create a new registration.
4. Choose supported account types:
   - Single tenant: only one organization.
   - Multitenant: work/school accounts from any organization.
   - Multitenant + personal Microsoft accounts: Outlook.com plus organizations.
5. Save the Application (client) ID.

### 2. Configure authentication

1. Open the app registration.
2. Go to Authentication.
3. Add a platform.
4. For this local MCP server, use Mobile and desktop applications or a localhost redirect configuration.
5. For direct local OAuth, add:

```text
http://127.0.0.1:8741/oauth/callback
```

For hosted broker mode, add:

```text
https://auth.example.com/auth/outlook/callback
```

6. Enable public client/native flow if you are not using a client secret.

### 3. Configure Microsoft Graph delegated permissions

Add delegated Microsoft Graph permissions:

```text
offline_access
User.Read
Mail.ReadWrite
Mail.Send
```

This MCP server acts on behalf of the signed-in mailbox user, so use delegated permissions, not application permissions.

### 4. Decide consent model

For personal Microsoft accounts, the user can usually consent directly.

For work/school tenants, the tenant's policies may require admin consent. If a client sees "Need admin approval," an administrator for that tenant must approve the app or grant tenant-wide admin consent.

### 5. Add environment variables

```bash
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
```

`MICROSOFT_CLIENT_SECRET` is optional when using a public/native-client flow. `MICROSOFT_TENANT_ID=common` supports multiple Microsoft account types if the app registration allows them.

### 6. Test Outlook auth

1. Start the MCP server.
2. Call `start_outlook_oauth`.
3. Sign in and consent in the browser window.
4. Call `list_accounts`.
5. Confirm an `outlook:<email>` account appears.

## Client Distribution Checklist

Before giving this repo to a client:

1. Decide whether you will provide managed OAuth app values or ask the client to create their own apps.
2. Do not commit `.env`, OAuth secrets, or token files.
3. Add the client's user emails as Google test users if Google verification is not complete.
4. For Microsoft work/school clients, identify who can approve tenant app consent.
5. Run:

```bash
npm install
npm run doctor
npm run build
```

6. Register the MCP server with the client's MCP host using:

```bash
codex mcp add multi-account-email --env-file /absolute/path/to/.env -- npm --prefix /absolute/path/to/email-mcp-server run mcp:stdio
```
