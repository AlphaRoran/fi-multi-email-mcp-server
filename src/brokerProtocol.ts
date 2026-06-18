import { createHmac, randomBytes, sign, timingSafeEqual, verify } from "node:crypto";
import { accountId, type Provider, type StoredAccount } from "./storage.js";

export type BrokerCallbackPayload = {
  provider: Provider;
  email: string;
  displayName?: string;
  scopes: string[];
  tokens: Record<string, unknown>;
  issuedAt: number;
  nonce: string;
};

export type BrokerCallbackEnvelope = {
  payload: BrokerCallbackPayload;
  signature: string;
  signatureType: "hmac-sha256" | "ed25519";
};

type BrokerSigningOptions = {
  sharedSecret?: string;
  privateKeyPem?: string;
};

type BrokerVerifyOptions = {
  sharedSecret?: string;
  publicKeyPem?: string;
};

export function createBrokerSessionState(provider: Provider, localCallbackUrl: string, sharedSecret?: string): string {
  const payload = {
    provider,
    localCallbackUrl,
    nonce: randomBytes(24).toString("hex"),
    issuedAt: Date.now()
  };
  const envelope = sharedSecret
    ? { payload, signature: signHmac(payload, sharedSecret), signatureType: "hmac-sha256" }
    : { payload };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export function parseBrokerSessionState(
  encoded: string,
  sharedSecret?: string
): {
  provider: Provider;
  localCallbackUrl: string;
  nonce: string;
  issuedAt: number;
} {
  const envelope = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
    payload: {
      provider: Provider;
      localCallbackUrl: string;
      nonce: string;
      issuedAt: number;
    };
    signature?: string;
  };
  if (sharedSecret) {
    if (!envelope.signature) {
      throw new Error("Broker session state signature is missing");
    }
    verifyHmac(envelope.payload, envelope.signature, sharedSecret);
  }
  if (Date.now() - envelope.payload.issuedAt > 10 * 60 * 1000) {
    throw new Error("Broker session state expired");
  }
  if (!["gmail", "outlook"].includes(envelope.payload.provider)) {
    throw new Error("Broker session state provider is invalid");
  }
  if (!envelope.payload.localCallbackUrl.startsWith("http://127.0.0.1:")) {
    throw new Error("Broker local callback URL must use 127.0.0.1");
  }
  return envelope.payload;
}

export function createBrokerCallbackEnvelope(
  payload: Omit<BrokerCallbackPayload, "issuedAt" | "nonce">,
  options: BrokerSigningOptions
): BrokerCallbackEnvelope {
  const fullPayload = {
    ...payload,
    issuedAt: Date.now(),
    nonce: randomBytes(24).toString("hex")
  };
  if (options.privateKeyPem) {
    return {
      payload: fullPayload,
      signature: signEd25519(fullPayload, options.privateKeyPem),
      signatureType: "ed25519"
    };
  }
  return {
    payload: fullPayload,
    signature: signHmac(fullPayload, requiredOption(options.sharedSecret, "sharedSecret")),
    signatureType: "hmac-sha256"
  };
}

export function verifyBrokerCallbackEnvelope(envelope: BrokerCallbackEnvelope, options: BrokerVerifyOptions): StoredAccount {
  if (envelope.signatureType === "ed25519") {
    verifyEd25519(envelope.payload, envelope.signature, requiredOption(options.publicKeyPem, "publicKeyPem"));
  } else {
    verifyHmac(envelope.payload, envelope.signature, requiredOption(options.sharedSecret, "sharedSecret"));
  }
  if (Date.now() - envelope.payload.issuedAt > 2 * 60 * 1000) {
    throw new Error("Broker callback payload expired");
  }
  const { provider, email, displayName, scopes, tokens } = envelope.payload;
  if (!["gmail", "outlook"].includes(provider)) {
    throw new Error("Broker callback provider is invalid");
  }
  return {
    id: accountId(provider, email),
    provider,
    email,
    displayName,
    scopes,
    tokens,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function signHmac(payload: unknown, sharedSecret: string): string {
  if (!sharedSecret) {
    throw new Error("Broker shared secret is required");
  }
  return createHmac("sha256", sharedSecret).update(stableJson(payload)).digest("base64url");
}

function verifyHmac(payload: unknown, signature: string, sharedSecret: string): void {
  const expected = signHmac(payload, sharedSecret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid broker signature");
  }
}

function signEd25519(payload: unknown, privateKeyPem: string): string {
  return sign(null, Buffer.from(stableJson(payload)), privateKeyPem).toString("base64url");
}

function verifyEd25519(payload: unknown, signature: string, publicKeyPem: string): void {
  const valid = verify(null, Buffer.from(stableJson(payload)), publicKeyPem, Buffer.from(signature, "base64url"));
  if (!valid) {
    throw new Error("Invalid broker signature");
  }
}

function requiredOption(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Broker ${name} is required`);
  }
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
