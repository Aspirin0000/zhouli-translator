import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCaseSubmission,
  validateEventPayload,
} from "../lib/feedback-validation.ts";

const base = {
  response_id: "550e8400-e29b-41d4-a716-446655440000",
  feedback_token: "signed-token",
  surface: "web",
  client_version: "web-2026.07.27",
  release_channel: "development",
};

test("event validation accepts allowed interactions and structured reasons", () => {
  assert.deepEqual(
    validateEventPayload({
      ...base,
      event_type: "feedback_negative",
      reasons: ["too_long", "repetitive"],
    }),
    {
      responseId: base.response_id,
      feedbackToken: base.feedback_token,
      meta: {
        surface: "web",
        clientVersion: base.client_version,
        releaseChannel: "development",
      },
      eventType: "feedback_negative",
      reasons: ["too_long", "repetitive"],
      reasonDetail: null,
    },
  );
  assert.equal(
    validateEventPayload({ ...base, event_type: "copy" })?.eventType,
    "copy",
  );
  assert.deepEqual(
    validateEventPayload({
      ...base,
      event_type: "feedback_negative",
      reasons: ["other"],
      reason_detail: "释礼虽然准确，但读起来还是有些绕。",
    })?.reasonDetail,
    "释礼虽然准确，但读起来还是有些绕。",
  );
});

test("event validation rejects malformed or oversized payloads", () => {
  assert.equal(validateEventPayload({ ...base, event_type: "admin_dump" }), null);
  assert.equal(
    validateEventPayload({
      ...base,
      event_type: "feedback_negative",
      reasons: ["not_a_reason"],
    }),
    null,
  );
  assert.equal(
    validateEventPayload({
      ...base,
      event_type: "feedback_positive",
      reasons: ["too_long"],
    }),
    null,
  );
  assert.equal(
    validateEventPayload({
      ...base,
      response_id: "x".repeat(100),
      event_type: "copy",
    }),
    null,
  );
  assert.equal(
    validateEventPayload({
      ...base,
      event_type: "feedback_negative",
      reasons: ["other"],
    }),
    null,
  );
  assert.equal(
    validateEventPayload({
      ...base,
      event_type: "feedback_negative",
      reasons: ["too_long"],
      reason_detail: "不应附带自定义说明",
    }),
    null,
  );
  assert.equal(
    validateEventPayload({
      ...base,
      event_type: "feedback_negative",
      reasons: ["other"],
      reason_detail: "字".repeat(301),
    }),
    null,
  );
});

test("case validation requires explicit consent and bounded text", () => {
  const valid = validateCaseSubmission({
    ...base,
    input_text: "原话",
    output_text: "周礼体",
    feedback_reasons: ["meaning_drift"],
    consent: true,
    consent_version: "2026-07-27",
  });
  assert.deepEqual(valid?.feedbackReasons, ["meaning_drift"]);
  assert.equal(valid?.publicDisplayAllowed, false);

  assert.equal(
    validateCaseSubmission({
      ...base,
      input_text: "原话",
      output_text: "周礼体",
      consent: false,
      consent_version: "2026-07-27",
    }),
    null,
  );
  assert.equal(
    validateCaseSubmission({
      ...base,
      input_text: "原话",
      output_text: "周礼体",
      consent: true,
      consent_version: "2026-07-27",
      public_display_allowed: true,
    }),
    null,
  );
});
