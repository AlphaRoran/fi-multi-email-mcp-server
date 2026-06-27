import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type McpToolResult = {
  content?: Array<{ type: string; text?: string }>;
};

export async function callEmailMcpTool<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  const transport = new StdioClientTransport({
    command: "npm",
    args: ["run", "mcp:stdio"],
    cwd: process.cwd(),
    env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
  });

  const client = new Client({ name: "email-automation-runner", version: "0.1.0" });
  await client.connect(transport);
  try {
    const result = (await client.callTool({ name: toolName, arguments: args })) as McpToolResult;
    const text = result.content?.find((item) => item.type === "text")?.text;
    if (!text) {
      throw new Error(`MCP tool ${toolName} returned no text content`);
    }
    return JSON.parse(text) as T;
  } finally {
    await client.close();
  }
}
