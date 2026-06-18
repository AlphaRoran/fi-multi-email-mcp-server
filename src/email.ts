import { Buffer } from "node:buffer";
import { google, gmail_v1 } from "googleapis";
import { graphFetch, makeGoogleOAuthClient, refreshOutlookToken } from "./oauth.js";
import type { Provider, StoredAccount, TokenStore } from "./storage.js";

export type SearchInput = {
  accountId: string;
  query?: string;
  maxResults?: number;
};

export type ReadInput = {
  accountId: string;
  messageId: string;
};

export type SendInput = {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  replyToMessageId?: string;
};

export type ModifyInput = {
  accountId: string;
  messageId: string;
  markRead?: boolean;
  archive?: boolean;
  trash?: boolean;
  addLabels?: string[];
  removeLabels?: string[];
  addCategories?: string[];
  removeCategories?: string[];
  moveToFolderId?: string;
};

export type MailboxInput = {
  accountId: string;
  name: string;
  mailboxId?: string;
  parentFolderId?: string;
};

export class EmailService {
  constructor(private readonly store: TokenStore) {}

  async listAccounts() {
    const accounts = await this.store.list();
    return accounts.map(({ tokens: _tokens, ...safe }) => safe);
  }

  async listMailboxes(accountId: string) {
    const account = await this.store.get(accountId);
    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      const response = await gmail.users.labels.list({ userId: "me" });
      return {
        provider: account.provider,
        accountId,
        mailboxes: (response.data.labels || []).map((label) => ({
          id: label.id,
          name: label.name,
          type: label.type,
          messageListVisibility: label.messageListVisibility
        }))
      };
    }

    const token = await refreshOutlookToken(account, this.store);
    const folders = await graphFetch<{ value: Array<{ id: string; displayName: string; totalItemCount: number; unreadItemCount: number }> }>(
      "/me/mailFolders?$top=100",
      token
    );
    return {
      provider: account.provider,
      accountId,
      mailboxes: folders.value.map((folder) => ({
        id: folder.id,
        name: folder.displayName,
        totalItemCount: folder.totalItemCount,
        unreadItemCount: folder.unreadItemCount
      }))
    };
  }

  async createMailbox(input: MailboxInput) {
    const account = await this.store.get(input.accountId);
    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      const response = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: input.name,
          labelListVisibility: "labelShow",
          messageListVisibility: "show"
        }
      });
      return { provider: account.provider, accountId: input.accountId, mailbox: response.data };
    }

    const token = await refreshOutlookToken(account, this.store);
    const path = input.parentFolderId
      ? `/me/mailFolders/${encodeURIComponent(input.parentFolderId)}/childFolders`
      : "/me/mailFolders";
    const folder = await graphFetch(path, token, {
      method: "POST",
      body: JSON.stringify({ displayName: input.name })
    });
    return { provider: account.provider, accountId: input.accountId, mailbox: folder };
  }

  async renameMailbox(input: MailboxInput) {
    if (!input.mailboxId) {
      throw new Error("rename_mailbox requires mailboxId");
    }
    const account = await this.store.get(input.accountId);
    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      const response = await gmail.users.labels.update({
        userId: "me",
        id: input.mailboxId,
        requestBody: { name: input.name }
      });
      return { provider: account.provider, accountId: input.accountId, mailbox: response.data };
    }

    const token = await refreshOutlookToken(account, this.store);
    const folder = await graphFetch(`/me/mailFolders/${encodeURIComponent(input.mailboxId)}`, token, {
      method: "PATCH",
      body: JSON.stringify({ displayName: input.name })
    });
    return { provider: account.provider, accountId: input.accountId, mailbox: folder };
  }

  async deleteMailbox(accountId: string, mailboxId: string) {
    const account = await this.store.get(accountId);
    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      await gmail.users.labels.delete({ userId: "me", id: mailboxId });
      return { provider: account.provider, accountId, mailboxId, deleted: true };
    }

    const token = await refreshOutlookToken(account, this.store);
    await graphFetch(`/me/mailFolders/${encodeURIComponent(mailboxId)}`, token, { method: "DELETE" });
    return { provider: account.provider, accountId, mailboxId, deleted: true };
  }

  async searchMessages(input: SearchInput) {
    const account = await this.store.get(input.accountId);
    const maxResults = Math.min(Math.max(input.maxResults || 10, 1), 50);

    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      const list = await gmail.users.messages.list({
        userId: "me",
        q: input.query,
        maxResults
      });
      const messages = await Promise.all(
        (list.data.messages || []).map(async (message) => {
          const response = await gmail.users.messages.get({
            userId: "me",
            id: message.id || "",
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"]
          });
          return normalizeGmailMessage(response.data);
        })
      );
      return { provider: account.provider, accountId: input.accountId, messages };
    }

    const token = await refreshOutlookToken(account, this.store);
    const params = new URLSearchParams({
      "$top": String(maxResults),
      "$select": "id,subject,from,toRecipients,receivedDateTime,sentDateTime,isRead,bodyPreview,webLink"
    });
    if (input.query) {
      params.set("$search", `"${input.query.replaceAll("\"", "\\\"")}"`);
    }
    const response = await graphFetch<{ value: GraphMessage[] }>(`/me/messages?${params.toString()}`, token, {
      headers: input.query ? { ConsistencyLevel: "eventual" } : undefined
    });
    return {
      provider: account.provider,
      accountId: input.accountId,
      messages: response.value.map((message) => normalizeGraphMessage(message))
    };
  }

  async readMessage(input: ReadInput) {
    const account = await this.store.get(input.accountId);
    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      const response = await gmail.users.messages.get({
        userId: "me",
        id: input.messageId,
        format: "full"
      });
      return {
        provider: account.provider,
        accountId: input.accountId,
        message: {
          ...normalizeGmailMessage(response.data),
          textBody: extractGmailBody(response.data.payload, "text/plain"),
          htmlBody: extractGmailBody(response.data.payload, "text/html")
        }
      };
    }

    const token = await refreshOutlookToken(account, this.store);
    const message = await graphFetch<GraphMessage>(
      `/me/messages/${encodeURIComponent(input.messageId)}?$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,isRead,body,bodyPreview,webLink`,
      token
    );
    return { provider: account.provider, accountId: input.accountId, message: normalizeGraphMessage(message, true) };
  }

  async sendEmail(input: SendInput) {
    const account = await this.store.get(input.accountId);
    if (!input.text && !input.html) {
      throw new Error("send_email requires text or html content");
    }

    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      const raw = makeMimeMessage(input);
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw,
          threadId: input.replyToMessageId
        }
      });
      return { provider: account.provider, accountId: input.accountId, id: response.data.id, threadId: response.data.threadId };
    }

    const token = await refreshOutlookToken(account, this.store);
    const message = {
      subject: input.subject,
      body: {
        contentType: input.html ? "HTML" : "Text",
        content: input.html || input.text
      },
      toRecipients: input.to.map(emailAddress),
      ccRecipients: (input.cc || []).map(emailAddress),
      bccRecipients: (input.bcc || []).map(emailAddress)
    };

    if (input.replyToMessageId) {
      await graphFetch(`/me/messages/${encodeURIComponent(input.replyToMessageId)}/reply`, token, {
        method: "POST",
        body: JSON.stringify({ message, comment: input.text || "" })
      });
      return { provider: account.provider, accountId: input.accountId, status: "reply_sent" };
    }

    await graphFetch("/me/sendMail", token, {
      method: "POST",
      body: JSON.stringify({ message, saveToSentItems: true })
    });
    return { provider: account.provider, accountId: input.accountId, status: "sent" };
  }

  async modifyMessage(input: ModifyInput) {
    const account = await this.store.get(input.accountId);
    if (account.provider === "gmail") {
      const gmail = await this.gmail(account);
      if (input.trash) {
        const response = await gmail.users.messages.trash({ userId: "me", id: input.messageId });
        return { provider: account.provider, accountId: input.accountId, message: normalizeGmailMessage(response.data) };
      }

      const addLabelIds = [...(input.addLabels || [])];
      const removeLabelIds = [...(input.removeLabels || [])];
      if (input.archive) {
        removeLabelIds.push("INBOX");
      }
      if (input.markRead === true) {
        removeLabelIds.push("UNREAD");
      } else if (input.markRead === false) {
        addLabelIds.push("UNREAD");
      }

      const response = await gmail.users.messages.modify({
        userId: "me",
        id: input.messageId,
        requestBody: {
          addLabelIds: unique(addLabelIds),
          removeLabelIds: unique(removeLabelIds)
        }
      });
      return { provider: account.provider, accountId: input.accountId, message: normalizeGmailMessage(response.data) };
    }

    const token = await refreshOutlookToken(account, this.store);
    if (input.trash) {
      await graphFetch(`/me/messages/${encodeURIComponent(input.messageId)}/move`, token, {
        method: "POST",
        body: JSON.stringify({ destinationId: "deleteditems" })
      });
      return { provider: account.provider, accountId: input.accountId, status: "moved_to_deleteditems" };
    }
    if (input.archive) {
      await graphFetch(`/me/messages/${encodeURIComponent(input.messageId)}/move`, token, {
        method: "POST",
        body: JSON.stringify({ destinationId: "archive" })
      });
      return { provider: account.provider, accountId: input.accountId, status: "archived" };
    }
    if (input.moveToFolderId) {
      await graphFetch(`/me/messages/${encodeURIComponent(input.messageId)}/move`, token, {
        method: "POST",
        body: JSON.stringify({ destinationId: input.moveToFolderId })
      });
      return { provider: account.provider, accountId: input.accountId, status: "moved" };
    }
    if (typeof input.markRead === "boolean") {
      const message = await graphFetch<GraphMessage>(`/me/messages/${encodeURIComponent(input.messageId)}`, token, {
        method: "PATCH",
        body: JSON.stringify({ isRead: input.markRead })
      });
      return { provider: account.provider, accountId: input.accountId, message: normalizeGraphMessage(message) };
    }
    if (input.addCategories?.length || input.removeCategories?.length) {
      const current = await graphFetch<GraphMessage>(
        `/me/messages/${encodeURIComponent(input.messageId)}?$select=id,categories`,
        token
      );
      const categories = new Set(current.categories || []);
      for (const category of input.addCategories || []) {
        categories.add(category);
      }
      for (const category of input.removeCategories || []) {
        categories.delete(category);
      }
      const message = await graphFetch<GraphMessage>(`/me/messages/${encodeURIComponent(input.messageId)}`, token, {
        method: "PATCH",
        body: JSON.stringify({ categories: [...categories] })
      });
      return { provider: account.provider, accountId: input.accountId, message: normalizeGraphMessage(message) };
    }

    return { provider: account.provider, accountId: input.accountId, status: "no_change" };
  }

  private async gmail(account: StoredAccount) {
    if (account.provider !== "gmail") {
      throw new Error(`Account ${account.id} is ${account.provider}, not gmail`);
    }
    const client = makeGoogleOAuthClient();
    client.setCredentials(account.tokens);
    client.on("tokens", (tokens) => {
      void this.store.updateTokens(account.id, tokens as Record<string, unknown>);
    });
    await client.getAccessToken();
    return google.gmail({ version: "v1", auth: client as never });
  }
}

function normalizeGmailMessage(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers || [];
  return {
    id: message.id,
    threadId: message.threadId,
    labels: message.labelIds || [],
    snippet: message.snippet,
    historyId: message.historyId,
    internalDate: message.internalDate,
    from: gmailHeader(headers, "From"),
    to: gmailHeader(headers, "To"),
    subject: gmailHeader(headers, "Subject"),
    date: gmailHeader(headers, "Date")
  };
}

function gmailHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | undefined {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || undefined;
}

function extractGmailBody(part: gmail_v1.Schema$MessagePart | undefined, mimeType: string): string | undefined {
  if (!part) {
    return undefined;
  }
  if (part.mimeType === mimeType && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const child of part.parts || []) {
    const value = extractGmailBody(child, mimeType);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function makeMimeMessage(input: SendInput): string {
  const headers = [
    `To: ${input.to.join(", ")}`,
    input.cc?.length ? `Cc: ${input.cc.join(", ")}` : undefined,
    input.bcc?.length ? `Bcc: ${input.bcc.join(", ")}` : undefined,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${input.html ? "text/html" : "text/plain"}; charset=UTF-8`
  ].filter(Boolean);
  const body = input.html || input.text || "";
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

type GraphMessage = {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  bccRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  categories?: string[];
  webLink?: string;
};

function normalizeGraphMessage(message: GraphMessage, includeBody = false) {
  return {
    id: message.id,
    subject: message.subject,
    from: message.from?.emailAddress,
    to: message.toRecipients?.map((recipient) => recipient.emailAddress),
    cc: message.ccRecipients?.map((recipient) => recipient.emailAddress),
    bcc: message.bccRecipients?.map((recipient) => recipient.emailAddress),
    receivedDateTime: message.receivedDateTime,
    sentDateTime: message.sentDateTime,
    isRead: message.isRead,
    bodyPreview: message.bodyPreview,
    categories: message.categories,
    webLink: message.webLink,
    body: includeBody ? message.body : undefined
  };
}

function emailAddress(address: string) {
  return { emailAddress: { address } };
}

export function assertProvider(provider: string): asserts provider is Provider {
  if (provider !== "gmail" && provider !== "outlook") {
    throw new Error(`Unknown provider: ${provider}`);
  }
}
