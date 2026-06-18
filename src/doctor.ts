import "dotenv/config";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { TokenStore } from "./storage.js";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const checks: Check[] = [];
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");

checks.push({
  name: "Node.js",
  ok: Number(process.versions.node.split(".")[0]) >= 20,
  detail: `running ${process.version}; requires >=20`
});

checks.push({
  name: "package install",
  ok: existsSync(resolve(root, "node_modules")),
  detail: existsSync(resolve(root, "node_modules")) ? "node_modules present" : "run npm install"
});

checks.push(envCheck("GOOGLE_CLIENT_ID", "required for Gmail OAuth"));
checks.push(envCheck("GOOGLE_CLIENT_SECRET", "required for Gmail OAuth"));
checks.push(envCheck("MICROSOFT_CLIENT_ID", "required for Outlook OAuth"));
checks.push({
  name: "MICROSOFT_TENANT_ID",
  ok: true,
  detail: process.env.MICROSOFT_TENANT_ID ? "set" : "not set; defaults to common"
});

const store = new TokenStore();
checks.push({
  name: "token store",
  ok: true,
  detail: tokenStoreDetail(store.path)
});

const coreReady = checks
  .filter((check) => check.name === "Node.js" || check.name === "package install")
  .every((check) => check.ok);
const gmailReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const outlookReady = Boolean(process.env.MICROSOFT_CLIENT_ID);

for (const check of checks) {
  const mark = check.ok ? "ok" : "missing";
  console.log(`${mark.padEnd(7)} ${check.name}: ${check.detail}`);
}

console.log("");
console.log(`provider Gmail: ${gmailReady ? "ready" : "not configured"}`);
console.log(`provider Outlook: ${outlookReady ? "ready" : "not configured"}`);

if (!coreReady || (!gmailReady && !outlookReady)) {
  process.exitCode = 1;
}

function envCheck(name: string, detail: string): Check {
  return {
    name,
    ok: Boolean(process.env[name]),
    detail: process.env[name] ? "set" : detail
  };
}

function tokenStoreDetail(path: string): string {
  if (!existsSync(path)) {
    return `${path} will be created on first auth`;
  }
  const stats = statSync(path);
  return `${path} exists, ${stats.size} bytes`;
}
