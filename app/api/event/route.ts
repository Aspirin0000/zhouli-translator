import { NextRequest } from "next/server";
import {
  findGeneration,
  hasQualityFeedback,
  recordInteraction,
  type InteractionRecord,
} from "@/lib/analytics-store";
import { getAnalyticsConfig } from "@/lib/analytics";
import { getAnalyticsRuntime } from "@/lib/analytics-runtime";
import { corsJson, corsOptions, readJsonBody } from "@/lib/cors";
import { verifyFeedbackToken } from "@/lib/feedback-token";
import { allowInteractionRequest } from "@/lib/interaction-rate";
import { validateEventPayload } from "@/lib/feedback-validation";

export const runtime = "nodejs";

export function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

export async function POST(request: NextRequest) {
  if (!allowInteractionRequest(request)) {
    return corsJson(request, { error: "反馈过于频繁，请稍后再试。" }, { status: 429 });
  }

  const body = await readJsonBody(request, 8 * 1024);
  const payload = validateEventPayload(body);
  if (!payload || payload.eventType === "case_submit") {
    return corsJson(request, { error: "反馈格式不合礼数。" }, { status: 400 });
  }

  const runtime = await getAnalyticsRuntime();
  const config = getAnalyticsConfig(runtime.environment);
  if (!config.analyticsEnabled || !config.feedbackUiEnabled || !runtime.db || !runtime.feedbackSecret) {
    return corsJson(request, { accepted: false }, { status: 200 });
  }

  if (
    !(await verifyFeedbackToken(
      runtime.feedbackSecret,
      payload.feedbackToken,
      payload.responseId,
      payload.meta.surface,
    ))
  ) {
    return corsJson(request, { error: "反馈凭证已失效，请重新生成。" }, { status: 403 });
  }

  try {
    const generation = await findGeneration(runtime.db, payload.responseId);
    if (!generation || generation.surface !== payload.meta.surface || !generation.success) {
      return corsJson(request, { error: "此结果不存在或已失效。" }, { status: 404 });
    }

    if (
      (payload.eventType === "feedback_positive" || payload.eventType === "feedback_negative") &&
      (await hasQualityFeedback(runtime.db, payload.responseId))
    ) {
      return corsJson(request, { accepted: false, duplicate: true }, { status: 200 });
    }

    const record: InteractionRecord = {
      responseId: payload.responseId,
      createdAt: Date.now(),
      ...payload.meta,
      eventType: payload.eventType,
      reason: payload.reasons.length ? payload.reasons : null,
      reasonDetail: payload.reasonDetail,
    };
    const write = recordInteraction(runtime.db, record);
    if (runtime.waitUntil) {
      runtime.waitUntil(write);
    } else {
      await write;
    }

    return corsJson(request, { accepted: true }, { status: 200 });
  } catch (error) {
    console.error("Feedback event failed:", error instanceof Error ? error.message : "unknown");
    return corsJson(request, { accepted: false }, { status: 503 });
  }
}
