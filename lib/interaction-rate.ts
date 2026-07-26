import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 120;

type RateEntry = { startedAt: number; count: number };

const globalForInteractionRate = globalThis as typeof globalThis & {
  zhouliInteractionRate?: Map<string, RateEntry>;
};

const interactionRate =
  globalForInteractionRate.zhouliInteractionRate ?? new Map<string, RateEntry>();
globalForInteractionRate.zhouliInteractionRate = interactionRate;

export function allowInteractionRequest(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const key = forwarded?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = interactionRate.get(key);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    interactionRate.set(key, { startedAt: now, count: 1 });
    return true;
  }

  if (current.count >= MAX_EVENTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}
