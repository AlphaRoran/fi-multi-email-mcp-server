# Hosted OAuth Broker

The preferred client-friendly architecture is:

```text
Client Agent -> Local MCP -> Hosted OAuth Broker -> Google/Microsoft
                         <- Browser relay with signed token payload <-
```

The local MCP does not need Google or Microsoft OAuth secrets. Provider secrets live only on the hosted broker.

## Why The Browser Relay Exists

A hosted server cannot directly POST to `127.0.0.1` on the client's laptop. `127.0.0.1` from the broker means the broker itself.

Instead, after provider OAuth succeeds, the broker returns an HTML page with an auto-submitting form. The browser is running on the client's machine, so it can submit the signed payload to:

```text
http://127.0.0.1:8741/oauth/callback
```

The local MCP verifies the broker signature and stores the mailbox tokens locally.

## Secret Model

Preferred production mode:

- Broker has `BROKER_PRIVATE_KEY`.
- Local MCP has `EMAIL_MCP_BROKER_PUBLIC_KEY`.
- Provider OAuth secrets stay only on the broker.
- The public key is safe to distribute to clients.

Development fallback:

- Broker and local MCP can both use `EMAIL_MCP_BROKER_SHARED_SECRET`.
- Do not use shared-secret mode as the preferred client distribution path.

## Generate Broker Signing Keys

Run:

```bash
node -e 'const {generateKeyPairSync}=require("crypto"); const {publicKey,privateKey}=generateKeyPairSync("ed25519"); console.log("PUBLIC_KEY=" + JSON.stringify(publicKey.export({type:"spki",format:"pem"}))); console.log("PRIVATE_KEY=" + JSON.stringify(privateKey.export({type:"pkcs8",format:"pem"})));'
```

Store the private key only in the broker host environment:

```bash
BROKER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Ship the public key with the local MCP config:

```bash
EMAIL_MCP_BROKER_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

## Broker Environment

```bash
BROKER_PUBLIC_BASE_URL=https://auth.example.com
BROKER_PORT=8787
BROKER_PRIVATE_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
```

Run:

```bash
npm run broker:start
```

For local development:

```bash
npm run broker:dev
```

## Local MCP Client Environment

```bash
EMAIL_MCP_AUTH_BASE_URL=https://auth.example.com
EMAIL_MCP_BROKER_PUBLIC_KEY=
EMAIL_MCP_OAUTH_HOST=127.0.0.1
EMAIL_MCP_OAUTH_PORT=8741
```

No Google or Microsoft client secrets are needed locally.

## Provider Redirect URIs

When using the hosted broker, provider OAuth apps should point to the broker callbacks, not the local MCP callback.

Google OAuth client authorized redirect URI:

```text
https://auth.example.com/auth/gmail/callback
```

Microsoft redirect URI:

```text
https://auth.example.com/auth/outlook/callback
```

The local callback remains:

```text
http://127.0.0.1:8741/oauth/callback
```

but it is used only by the browser relay after the broker completes OAuth.

## Flow

1. Agent calls `start_gmail_oauth` or `start_outlook_oauth`.
2. Local MCP opens `https://auth.example.com/auth/<provider>/start?...`.
3. Broker redirects to Google or Microsoft.
4. User signs in and grants permissions.
5. Provider redirects back to the broker.
6. Broker exchanges the OAuth code using provider secrets.
7. Broker signs the account token payload.
8. Broker returns an auto-submit form to the local MCP callback.
9. Local MCP verifies the public-key signature and stores tokens locally.
10. Agent calls `list_accounts` and then acts on the selected `accountId`.

## Security Notes

- Keep `BROKER_PRIVATE_KEY` and provider OAuth secrets out of GitHub.
- Rotate the broker key if the private key leaks.
- Use HTTPS for `BROKER_PUBLIC_BASE_URL`.
- The broker does not need to retain refresh tokens in this architecture.
- Production sends and destructive actions should still be approval-gated by the agent workflow.

