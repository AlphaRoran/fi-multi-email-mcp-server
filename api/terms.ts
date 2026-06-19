export default function handler(
  _req: unknown,
  res: { setHeader: (name: string, value: string) => void; status: (code: number) => { send: (body: string) => void } }
) {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("x-robots-tag", "index, follow");
  res.status(200).send(page("Terms of Service", termsContent()));
}

function termsContent(): string {
  return `
    <h1>Terms of Service</h1>
    <p class="muted">Effective date: June 19, 2026</p>
    <p>
      Fender Industries Multi-Email MCP is provided to help authorized users connect and manage email accounts
      through a local MCP server and an agent workflow.
    </p>
    <h2>Authorized Use</h2>
    <p>
      You may use this app only with email accounts you own or are authorized to manage. You are responsible for
      reviewing agent actions before approving sends or destructive mailbox changes.
    </p>
    <h2>OAuth Consent</h2>
    <p>
      Connecting an account requires consent through Google or Microsoft. You may revoke access at any time from
      your provider account settings or by removing the account from the MCP server.
    </p>
    <h2>No Warranty</h2>
    <p>
      The software is provided as-is. Fender Industries does not guarantee uninterrupted service or error-free
      mailbox operations.
    </p>
    <h2>Contact</h2>
    <p>
      For terms questions, contact Fender Industries at the support email shown on the OAuth consent screen.
    </p>
    <p><a href="/">Back to app overview</a></p>
  `;
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body { color: #1f2933; font-family: Arial, sans-serif; line-height: 1.6; margin: 0; }
      main { margin: 0 auto; max-width: 760px; padding: 48px 24px; }
      h1 { font-size: 36px; line-height: 1.15; margin: 0 0 20px; }
      h2 { font-size: 20px; margin-top: 32px; }
      a { color: #0f62fe; }
      .muted { color: #52606d; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}
