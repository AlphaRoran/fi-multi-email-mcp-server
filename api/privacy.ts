export default function handler(
  _req: unknown,
  res: { setHeader: (name: string, value: string) => void; status: (code: number) => { send: (body: string) => void } }
) {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("x-robots-tag", "index, follow");
  res.status(200).send(page("Privacy Policy", privacyContent()));
}

function privacyContent(): string {
  return `
    <h1>Privacy Policy</h1>
    <p class="muted">Effective date: June 19, 2026</p>
    <p>
      Fender Industries Multi-Email MCP helps users connect Gmail and Outlook accounts to a local MCP server
      so an authorized AI agent can help search, read, organize, and send email from accounts the user selects.
    </p>
    <h2>Information We Process</h2>
    <ul>
      <li>Email account identifiers, such as the email address returned by Google or Microsoft.</li>
      <li>OAuth access and refresh tokens issued after the user grants consent.</li>
      <li>Email metadata and message content only when requested through an MCP tool call.</li>
    </ul>
    <h2>How Information Is Used</h2>
    <p>
      Information is used only to provide requested email-management features, including account listing,
      message search, message reading, labeling or folder organization, read-state changes, archiving,
      trash actions, and sending email from a selected account.
    </p>
    <h2>Storage</h2>
    <p>
      The hosted OAuth broker exchanges OAuth codes and returns a signed authorization result to the local MCP
      callback in the user's browser. The broker is not designed to retain mailbox tokens or message bodies.
      Runtime account tokens are stored by the local MCP server on the user's machine unless the operator
      configures a different private token store.
    </p>
    <h2>Sharing</h2>
    <p>
      We do not sell, rent, or transfer Google user data to advertising platforms. Email data is not used to train
      generalized AI models. Data is shared only with Google or Microsoft APIs as necessary to provide the
      user-requested email functionality.
    </p>
    <h2>User Control</h2>
    <p>
      Users can remove connected accounts from the MCP server and can revoke access from their Google Account
      or Microsoft account security settings.
    </p>
    <h2>Contact</h2>
    <p>
      For privacy questions, contact Fender Industries at the support email shown on the OAuth consent screen.
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
