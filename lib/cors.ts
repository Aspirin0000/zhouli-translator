import { NextRequest, NextResponse } from "next/server";

export const CORS_ORIGINS = new Set([
  "https://hehuzhouli.com",
  "https://www.hehuzhouli.com",
  "https://www.bilibili.com",
  "https://bilibili.com",
  "https://www.bilibilitoy.com",
  "https://bilibilitoy.com",
  // Keep the previous temporary Toy host while old embeds still resolve.
  "https://www.bebox.net",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

export function getCorsHeaders(request: NextRequest) {
  const headers = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-client-id",
  });
  const origin = request.headers.get("origin");

  if (origin && CORS_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function corsJson(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
) {
  const headers = getCorsHeaders(request);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return NextResponse.json(body, { ...init, headers });
}

export function corsOptions(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function readJsonBody(request: NextRequest, maxBytes: number) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) return null;

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
