import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AnalyticsDatabase } from "./analytics-store";

type RuntimeContext = {
  env?: {
    ANALYTICS_DB?: AnalyticsDatabase;
    RESPONSE_FEEDBACK_SECRET?: string;
    [key: string]: unknown;
  };
  ctx?: {
    waitUntil?: (promise: Promise<unknown>) => void;
  };
};

export async function getAnalyticsRuntime() {
  try {
    const context = (await getCloudflareContext({ async: true })) as unknown as RuntimeContext;
    const env = context.env ?? {};
    return {
      db: env.ANALYTICS_DB ?? null,
      feedbackSecret: env.RESPONSE_FEEDBACK_SECRET ?? process.env.RESPONSE_FEEDBACK_SECRET ?? "",
      environment: { ...(process.env as Record<string, unknown>), ...env },
      waitUntil: context.ctx?.waitUntil?.bind(context.ctx),
    };
  } catch {
    return {
      db: null,
      feedbackSecret: process.env.RESPONSE_FEEDBACK_SECRET ?? "",
      environment: process.env as Record<string, unknown>,
      waitUntil: undefined,
    };
  }
}

export function runInBackground(
  promise: Promise<unknown>,
  waitUntil?: (promise: Promise<unknown>) => void,
) {
  if (waitUntil) {
    waitUntil(promise);
    return;
  }
  void promise;
}
