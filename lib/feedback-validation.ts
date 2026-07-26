import {
  isEventType,
  isNegativeReason,
  parseAnalyticsMeta,
  type AnalyticsMeta,
  type EventType,
  type NegativeReason,
} from "./analytics.ts";

const RESPONSE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REASON_COUNT = 7;
const MAX_REASON_DETAIL_LENGTH = 300;
const INVALID_REASON_DETAIL = Symbol("invalid_reason_detail");

type SharedPayload = {
  response_id?: unknown;
  feedback_token?: unknown;
  surface?: unknown;
  client_version?: unknown;
  release_channel?: unknown;
};

function parseSharedPayload(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const value = input as SharedPayload;
  if (
    value.surface === undefined ||
    value.client_version === undefined ||
    value.release_channel === undefined
  ) {
    return null;
  }
  const meta = parseAnalyticsMeta({
    surface: value.surface,
    client_version: value.client_version,
    release_channel: value.release_channel,
  });
  if (
    !meta ||
    typeof value.response_id !== "string" ||
    !RESPONSE_ID_PATTERN.test(value.response_id) ||
    typeof value.feedback_token !== "string" ||
    value.feedback_token.length < 8 ||
    value.feedback_token.length > 512
  ) {
    return null;
  }

  return {
    responseId: value.response_id,
    feedbackToken: value.feedback_token,
    meta,
  };
}

function parseReasons(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_REASON_COUNT) {
    return null;
  }
  const reasons = [...new Set(value)];
  if (reasons.length !== value.length || !reasons.every(isNegativeReason)) return null;
  return reasons as NegativeReason[];
}

function parseReasonDetail(value: unknown, reasons: NegativeReason[]) {
  if (!reasons.includes("other")) {
    return value === undefined ? null : INVALID_REASON_DETAIL;
  }
  if (typeof value !== "string") return INVALID_REASON_DETAIL;
  const detail = value.trim();
  if (!detail || Array.from(detail).length > MAX_REASON_DETAIL_LENGTH) {
    return INVALID_REASON_DETAIL;
  }
  return detail;
}

export type ValidatedEventPayload = {
  responseId: string;
  feedbackToken: string;
  meta: AnalyticsMeta;
  eventType: EventType;
  reasons: NegativeReason[];
  reasonDetail: string | null;
};

export function validateEventPayload(input: unknown): ValidatedEventPayload | null {
  const shared = parseSharedPayload(input);
  if (!shared || !input || typeof input !== "object") return null;
  const value = input as {
    event_type?: unknown;
    reasons?: unknown;
    reason_detail?: unknown;
  };
  if (!isEventType(value.event_type)) return null;

  if (value.event_type === "feedback_negative") {
    const reasons = parseReasons(value.reasons);
    if (!reasons) return null;
    const reasonDetail = parseReasonDetail(value.reason_detail, reasons);
    if (reasonDetail === INVALID_REASON_DETAIL) return null;
    return { ...shared, eventType: value.event_type, reasons, reasonDetail };
  }

  if (value.reasons !== undefined || value.reason_detail !== undefined) return null;
  return { ...shared, eventType: value.event_type, reasons: [], reasonDetail: null };
}

export type ValidatedCaseSubmission = {
  responseId: string;
  feedbackToken: string;
  meta: AnalyticsMeta;
  inputText: string;
  outputText: string;
  feedbackReasons: NegativeReason[];
  feedbackReasonDetail: string | null;
  consentVersion: string;
  publicDisplayAllowed: false;
};

export function validateCaseSubmission(input: unknown): ValidatedCaseSubmission | null {
  const shared = parseSharedPayload(input);
  if (!shared || !input || typeof input !== "object") return null;
  const value = input as {
    input_text?: unknown;
    output_text?: unknown;
    feedback_reasons?: unknown;
    feedback_reason_detail?: unknown;
    consent?: unknown;
    consent_version?: unknown;
    public_display_allowed?: unknown;
  };
  if (
    typeof value.input_text !== "string" ||
    value.input_text.length < 1 ||
    value.input_text.length > 900 ||
    typeof value.output_text !== "string" ||
    value.output_text.length < 1 ||
    value.output_text.length > 20_000 ||
    value.consent !== true ||
    typeof value.consent_version !== "string" ||
    !/^[A-Za-z0-9._-]{1,32}$/.test(value.consent_version) ||
    (value.public_display_allowed !== undefined && value.public_display_allowed !== false)
  ) {
    return null;
  }

  let feedbackReasons: NegativeReason[] = [];
  if (value.feedback_reasons !== undefined) {
    const parsedReasons = parseReasons(value.feedback_reasons);
    if (!parsedReasons) return null;
    feedbackReasons = parsedReasons;
  }
  const feedbackReasonDetail = parseReasonDetail(
    value.feedback_reason_detail,
    feedbackReasons,
  );
  if (feedbackReasonDetail === INVALID_REASON_DETAIL) return null;

  return {
    ...shared,
    inputText: value.input_text,
    outputText: value.output_text,
    feedbackReasons,
    feedbackReasonDetail,
    consentVersion: value.consent_version,
    publicDisplayAllowed: false,
  };
}
