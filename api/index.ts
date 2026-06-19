export default function handler(
  _req: unknown,
  res: { setHeader: (name: string, value: string) => void; status: (code: number) => { send: (body: string) => void } }
) {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("x-robots-tag", "index, follow");
  res.status(200).send(page("Fender Industries Multi-Email MCP", mainContent()));
}

function mainContent(): string {
  return `
    <h1>Fender Industries Multi-Email MCP</h1>
    <p>
      Fender Industries Multi-Email MCP is an authorization broker for a local MCP server that lets an authorized
      AI agent help a user manage email accounts the user explicitly connects.
    </p>
    <p>
      Users sign in directly with Google or Microsoft. The app never asks users to share mailbox passwords.
      After consent, the local MCP server stores account tokens on the user's machine and requires an explicit
      account selection for mailbox actions.
    </p>
    <h2>What The App Does</h2>
    <ul>
      <li>Connect Gmail and Outlook accounts through OAuth consent.</li>
      <li>Search and read selected email messages.</li>
      <li>Create labels or folders and organize selected messages.</li>
      <li>Send email only through the connected account selected by the user or agent workflow.</li>
    </ul>
    <h2>Data Use</h2>
    <p>
      OAuth tokens are handed back to the local MCP server after consent. This hosted broker does not keep a mailbox
      database and does not sell, rent, or use email data for advertising.
    </p>
    <p>
      <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
    </p>
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
