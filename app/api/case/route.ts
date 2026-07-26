import { NextRequest } from "next/server";
import { getAnalyticsConfig } from "@/lib/analytics";
import {
  findGeneration,
  hasSubmittedCase,
  recordInteractionForCase,
  recordSubmittedCase,
} from "@/lib/analytics-store";
import { getAnalyticsRuntime } from "@/lib/analytics-runtime";
import { corsJson, corsOptions, readJsonBody } from "@/lib/cors";
import { verifyFeedbackToken } from "@/lib/feedback-token";
import { allowInteractionRequest } from "@/lib/interaction-rate";
import { validateCaseSubmission } from "@/lib/feedback-validation";

export const runtime = "nodejs";

const CASE_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

export function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

export async function POST(request: NextRequest) {
  if (!allowInteractionRequest(request)) {
    return corsJson(request, { error: "提交过于频繁，请稍后再试。" }, { status: 429 });
  }

  const body = await readJsonBody(request, 32 * 1024);
  const payload = validateCaseSubmission(body);
  if (!payload) {
    return corsJson(request, { error: "案例提交需要明确授权，且内容不能过长。" }, { status: 400 });
  }

  const runtime = await getAnalyticsRuntime();
  const config = getAnalyticsConfig(runtime.environment);
  if (!config.analyticsEnabled || !config.caseSubmissionEnabled || !runtime.db || !runtime.feedbackSecret) {
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
    return corsJson(request, { error: "提交凭证已失效，请重新生成。" }, { status: 403 });
  }

  try {
    const generation = await findGeneration(runtime.db, payload.responseId);
    if (!generation || generation.surface !== payload.meta.surface || !generation.success) {
      return corsJson(request, { error: "此结果不存在或已失效。" }, { status: 404 });
    }

    if (await hasSubmittedCase(runtime.db, payload.responseId)) {
      return corsJson(request, { accepted: false, duplicate: true }, { status: 200 });
    }

    const now = Date.now();
    const write = recordSubmittedCase(runtime.db, {
      responseId: payload.responseId,
      createdAt: now,
      ...payload.meta,
      inputText: payload.inputText,
      outputText: payload.outputText,
      feedbackReasons: payload.feedbackReasons,
      feedbackReasonDetail: payload.feedbackReasonDetail,
      consentVersion: payload.consentVersion,
      consentedAt: now,
      publicDisplayAllowed: false,
      deleteAfter: now + CASE_RETENTION_MS,
    }).then(() =>
      recordInteractionForCase(runtime.db!, {
        responseId: payload.responseId,
        createdAt: now,
        ...payload.meta,
      }),
    );

    if (runtime.waitUntil) {
      runtime.waitUntil(
        write.catch((error) => {
          console.error("Case submission failed:", error instanceof Error ? error.message : "unknown");
        }),
      );
      return corsJson(request, { accepted: true }, { status: 200 });
    }

    await write;
    return corsJson(request, { accepted: true }, { status: 200 });
  } catch (error) {
    console.error("Case submission failed:", error instanceof Error ? error.message : "unknown");
    return corsJson(request, { accepted: false }, { status: 503 });
  }
}
