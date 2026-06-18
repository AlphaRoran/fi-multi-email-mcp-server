import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { EmailService } from "./email.js";
import { OAuthManager } from "./oauth.js";
import { TokenStore } from "./storage.js";

const store = new TokenStore();
const oauth = new OAuthManager(store);
const email = new EmailService(store);

const server = new Server(
  {
    name: "multi-account-email-mcp-server",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const toolSchemas = {
  list_accounts: z.object({}),
  start_gmail_oauth: z.object({
    openBrowser: z.boolean().optional()
  }),
  start_outlook_oauth: z.object({
    openBrowser: z.boolean().optional()
  }),
  remove_account: z.object({
    accountId: z.string().min(1)
  }),
  list_mailboxes: z.object({
    accountId: z.string().min(1)
  }),
  create_mailbox: z.object({
    accountId: z.string().min(1),
    name: z.string().min(1),
    parentFolderId: z.string().optional()
  }),
  rename_mailbox: z.object({
    accountId: z.string().min(1),
    mailboxId: z.string().min(1),
    name: z.string().min(1)
  }),
  delete_mailbox: z.object({
    accountId: z.string().min(1),
    mailboxId: z.string().min(1)
  }),
  search_messages: z.object({
    accountId: z.string().min(1),
    query: z.string().optional(),
    maxResults: z.number().int().min(1).max(50).optional()
  }),
  read_message: z.object({
    accountId: z.string().min(1),
    messageId: z.string().min(1)
  }),
  send_email: z.object({
    accountId: z.string().min(1),
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional(),
    replyToMessageId: z.string().optional()
  }),
  modify_message: z.object({
    accountId: z.string().min(1),
    messageId: z.string().min(1),
    markRead: z.boolean().optional(),
    archive: z.boolean().optional(),
    trash: z.boolean().optional(),
    addLabels: z.array(z.string()).optional(),
    removeLabels: z.array(z.string()).optional(),
    addCategories: z.array(z.string()).optional(),
    removeCategories: z.array(z.string()).optional(),
    moveToFolderId: z.string().optional()
  })
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_accounts",
      description: "List authenticated Gmail and Outlook accounts. Tokens are never returned.",
      inputSchema: jsonSchema(toolSchemas.list_accounts)
    },
    {
      name: "start_gmail_oauth",
      description: "Start a Gmail OAuth flow, open the consent screen by default, and return the approval URL as a fallback. The local callback stores the resulting account.",
      inputSchema: jsonSchema(toolSchemas.start_gmail_oauth)
    },
    {
      name: "start_outlook_oauth",
      description: "Start an Outlook/Microsoft Graph OAuth flow, open the consent screen by default, and return the approval URL as a fallback. The local callback stores the resulting account.",
      inputSchema: jsonSchema(toolSchemas.start_outlook_oauth)
    },
    {
      name: "remove_account",
      description: "Remove one authenticated account from local token storage.",
      inputSchema: jsonSchema(toolSchemas.remove_account)
    },
    {
      name: "list_mailboxes",
      description: "List Gmail labels or Outlook folders for one selected account.",
      inputSchema: jsonSchema(toolSchemas.list_mailboxes)
    },
    {
      name: "create_mailbox",
      description: "Create a Gmail label or Outlook mail folder in one selected account.",
      inputSchema: jsonSchema(toolSchemas.create_mailbox)
    },
    {
      name: "rename_mailbox",
      description: "Rename a Gmail label or Outlook mail folder in one selected account.",
      inputSchema: jsonSchema(toolSchemas.rename_mailbox)
    },
    {
      name: "delete_mailbox",
      description: "Delete a Gmail label or Outlook mail folder in one selected account.",
      inputSchema: jsonSchema(toolSchemas.delete_mailbox)
    },
    {
      name: "search_messages",
      description: "Search messages in one selected account. Gmail uses Gmail search syntax; Outlook uses Microsoft Graph message search.",
      inputSchema: jsonSchema(toolSchemas.search_messages)
    },
    {
      name: "read_message",
      description: "Read one selected message from one selected account.",
      inputSchema: jsonSchema(toolSchemas.read_message)
    },
    {
      name: "send_email",
      description: "Send a message or reply from one selected account.",
      inputSchema: jsonSchema(toolSchemas.send_email)
    },
    {
      name: "modify_message",
      description: "Modify one selected message: mark read/unread, archive, trash, label in Gmail, or move in Outlook.",
      inputSchema: jsonSchema(toolSchemas.modify_message)
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name as keyof typeof toolSchemas;
  const schema = toolSchemas[name];
  if (!schema) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const input = schema.parse(request.params.arguments || {});
  const result = await callTool(name, input);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
});

async function callTool(name: keyof typeof toolSchemas, input: unknown) {
  switch (name) {
    case "list_accounts":
      return email.listAccounts();
    case "start_gmail_oauth":
      return oauth.startGmail(toolSchemas.start_gmail_oauth.parse(input));
    case "start_outlook_oauth":
      return oauth.startOutlook(toolSchemas.start_outlook_oauth.parse(input));
    case "remove_account": {
      const { accountId } = toolSchemas.remove_account.parse(input);
      return { removed: await store.remove(accountId) };
    }
    case "list_mailboxes":
      return email.listMailboxes(toolSchemas.list_mailboxes.parse(input).accountId);
    case "create_mailbox":
      return email.createMailbox(toolSchemas.create_mailbox.parse(input));
    case "rename_mailbox":
      return email.renameMailbox(toolSchemas.rename_mailbox.parse(input));
    case "delete_mailbox": {
      const { accountId, mailboxId } = toolSchemas.delete_mailbox.parse(input);
      return email.deleteMailbox(accountId, mailboxId);
    }
    case "search_messages":
      return email.searchMessages(toolSchemas.search_messages.parse(input));
    case "read_message":
      return email.readMessage(toolSchemas.read_message.parse(input));
    case "send_email":
      return email.sendEmail(toolSchemas.send_email.parse(input));
    case "modify_message":
      return email.modifyMessage(toolSchemas.modify_message.parse(input));
  }
}

function jsonSchema(schema: z.ZodTypeAny) {
  const shape = schema instanceof z.ZodObject ? schema.shape : {};
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const optional = value instanceof z.ZodOptional;
    const inner = optional ? value.unwrap() : value;
    properties[key] = zodToJsonSchema(inner);
    if (!optional) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodString) {
    return { type: "string" };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: "number" };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema.element) };
  }
  return {};
}

const transport = new StdioServerTransport();
await server.connect(transport);
