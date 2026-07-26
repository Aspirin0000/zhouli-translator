import assert from "node:assert/strict";
import test from "node:test";
import {
  createResponseId,
  signFeedbackToken,
  verifyFeedbackToken,
} from "../lib/feedback-token.ts";
import {
  recordGenerationSafely,
  recordInteractionSafely,
  recordSubmittedCaseSafely,
  type AnalyticsDatabase,
} from "../lib/analytics-store.ts";

const meta = {
  surface: "web" as const,
  clientVersion: "web-2026.07.27",
  releaseChannel: "development" as const,
};

test("feedback tokens bind response id and surface and expire", async () => {
  const now = 1_750_000_000_000;
  const responseId = createResponseId();
  const token = await signFeedbackToken(
    "test-secret",
    responseId,
    meta.surface,
    now,
  );

  assert.equal(
    await verifyFeedbackToken("test-secret", token, responseId, meta.surface, now),
    true,
  );
  assert.equal(
    await verifyFeedbackToken("test-secret", token, responseId, "bilibili_toy", now),
    false,
  );
  assert.equal(
    await verifyFeedbackToken("wrong-secret", token, responseId, meta.surface, now),
    false,
  );
  assert.equal(
    await verifyFeedbackToken(
      "test-secret",
      token,
      responseId,
      meta.surface,
      now + 8 * 24 * 60 * 60 * 1000,
    ),
    false,
  );
});

test("analytics writes are best-effort and never throw", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db: AnalyticsDatabase = {
    prepare(sql) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async run() {
              return { success: true };
            },
            async first() {
              return null;
            },
          };
        },
      };
    },
  };

  await assert.doesNotReject(() =>
    recordGenerationSafely(db, {
      responseId: "response-1",
      createdAt: 1,
      ...meta,
      mode: "gentle",
      promptVersion: "zhouli-v1",
      experimentVariant: "A",
      model: "deepseek-v4-flash",
      success: true,
      latencyMs: 12,
      inputChars: 3,
      outputChars: 8,
      inputTokens: 2,
      outputTokens: 5,
      errorClass: null,
    }),
  );
  await assert.doesNotReject(() =>
    recordInteractionSafely(db, {
      responseId: "response-1",
      createdAt: 2,
      ...meta,
      eventType: "feedback_negative",
      reason: ["other"],
      reasonDetail: "自定义反馈说明",
    }),
  );
  await assert.doesNotReject(() =>
    recordSubmittedCaseSafely(db, {
      responseId: "response-1",
      createdAt: 3,
      ...meta,
      inputText: "输入",
      outputText: "输出",
      feedbackReasons: ["too_long"],
      feedbackReasonDetail: null,
      consentVersion: "2026-07-27",
      consentedAt: 3,
      publicDisplayAllowed: false,
      deleteAfter: 5,
    }),
  );

  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /INSERT INTO generations/);
  assert.match(calls[1].sql, /INSERT INTO interactions/);
  assert.match(calls[1].sql, /reason_detail/);
  assert.match(calls[2].sql, /INSERT INTO submitted_cases/);
  assert.equal(calls[2].values.includes("输入"), true);
  assert.equal(calls[2].values.includes("输出"), true);
});

test("analytics writes swallow a D1 outage", async () => {
  const db: AnalyticsDatabase = {
    prepare() {
      throw new Error("D1 unavailable");
    },
  };

  await assert.doesNotReject(() =>
    recordGenerationSafely(db, {
      responseId: "response-1",
      createdAt: 1,
      ...meta,
      mode: "gentle",
      promptVersion: "zhouli-v1",
      experimentVariant: "A",
      model: "deepseek-v4-flash",
      success: false,
      latencyMs: 12,
      inputChars: 3,
      outputChars: null,
      inputTokens: null,
      outputTokens: null,
      errorClass: "provider_error",
    }),
  );
});
