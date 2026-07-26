import type { ClientSurface } from "./analytics";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export function createResponseId() {
  return crypto.randomUUID();
}

export async function signFeedbackToken(
  secret: string,
  responseId: string,
  surface: ClientSurface,
  now = Date.now(),
) {
  if (!secret) throw new Error("RESPONSE_FEEDBACK_SECRET is not configured");
  const expiresAt = now + TOKEN_TTL_MS;
  const payload = `${responseId}.${expiresAt}.${surface}`;
  const signature = toBase64Url(await hmac(secret, payload));
  return `${expiresAt}.${signature}`;
}

export async function verifyFeedbackToken(
  secret: string,
  token: string,
  responseId: string,
  surface: ClientSurface,
  now = Date.now(),
) {
  if (!secret || !token || !responseId) return false;
  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiresAt = Number(token.slice(0, separator));
  const signatureText = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now || !signatureText) return false;

  try {
    const expected = await hmac(secret, `${responseId}.${expiresAt}.${surface}`);
    const actual = fromBase64Url(signatureText);
    return constantTimeEqual(expected, actual);
  } catch {
    return false;
  }
}

export const FEEDBACK_TOKEN_TTL_MS = TOKEN_TTL_MS;
