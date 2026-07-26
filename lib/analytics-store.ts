import type {
  AnalyticsMeta,
  EventType,
  NegativeReason,
} from "./analytics";

export interface AnalyticsStatement {
  bind(...values: unknown[]): {
    run(): Promise<unknown>;
    first<T = unknown>(): Promise<T | null>;
  };
}

export interface AnalyticsDatabase {
  prepare(sql: string): AnalyticsStatement;
}

export type GenerationRecord = AnalyticsMeta & {
  responseId: string;
  createdAt: number;
  mode: string;
  promptVersion: string;
  experimentVariant: "A" | "B";
  model: string;
  success: boolean;
  latencyMs: number;
  inputChars: number;
  outputChars: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorClass: string | null;
};

export type InteractionRecord = AnalyticsMeta & {
  responseId: string;
  createdAt: number;
  eventType: EventType;
  reason: NegativeReason | NegativeReason[] | null;
  reasonDetail?: string | null;
};

export type SubmittedCaseRecord = AnalyticsMeta & {
  responseId: string;
  createdAt: number;
  inputText: string;
  outputText: string;
  feedbackReasons: NegativeReason[];
  feedbackReasonDetail: string | null;
  consentVersion: string;
  consentedAt: number;
  publicDisplayAllowed: boolean;
  deleteAfter: number;
};

export async function recordGeneration(
  db: AnalyticsDatabase,
  record: GenerationRecord,
) {
  await db
    .prepare(
      `INSERT INTO generations (
        response_id, created_at, surface, client_version, release_channel,
        mode, prompt_version, experiment_variant, model, success, latency_ms,
        input_chars, output_chars, input_tokens, output_tokens, error_class
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.responseId,
      record.createdAt,
      record.surface,
      record.clientVersion,
      record.releaseChannel,
      record.mode,
      record.promptVersion,
      record.experimentVariant,
      record.model,
      record.success ? 1 : 0,
      record.latencyMs,
      record.inputChars,
      record.outputChars,
      record.inputTokens,
      record.outputTokens,
      record.errorClass,
    )
    .run();
}

export async function recordInteraction(
  db: AnalyticsDatabase,
  record: InteractionRecord,
) {
  await db
    .prepare(
      `INSERT INTO interactions (
        response_id, created_at, surface, event_type, reason, reason_detail
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.responseId,
      record.createdAt,
      record.surface,
      record.eventType,
      Array.isArray(record.reason) ? JSON.stringify(record.reason) : record.reason,
      record.reasonDetail ?? null,
    )
    .run();
}

export async function recordSubmittedCase(
  db: AnalyticsDatabase,
  record: SubmittedCaseRecord,
) {
  await db
    .prepare(
      `INSERT INTO submitted_cases (
        response_id, created_at, surface, input_text, output_text,
        feedback_reasons, feedback_reason_detail, consent_version, consented_at,
        public_display_allowed, delete_after
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.responseId,
      record.createdAt,
      record.surface,
      record.inputText,
      record.outputText,
      JSON.stringify(record.feedbackReasons),
      record.feedbackReasonDetail,
      record.consentVersion,
      record.consentedAt,
      record.publicDisplayAllowed ? 1 : 0,
      record.deleteAfter,
    )
    .run();
}

export async function findGeneration(
  db: AnalyticsDatabase,
  responseId: string,
) {
  return db
    .prepare(
      `SELECT response_id, surface, success
       FROM generations
       WHERE response_id = ?
       LIMIT 1`,
    )
    .bind(responseId)
    .first<{
      response_id: string;
      surface: string;
      success: number;
    }>();
}

export async function hasQualityFeedback(
  db: AnalyticsDatabase,
  responseId: string,
) {
  const row = await db
    .prepare(
      `SELECT id
       FROM interactions
       WHERE response_id = ?
         AND event_type IN ('feedback_positive', 'feedback_negative')
       LIMIT 1`,
    )
    .bind(responseId)
    .first<{ id: number }>();
  return Boolean(row);
}

export async function hasSubmittedCase(
  db: AnalyticsDatabase,
  responseId: string,
) {
  const row = await db
    .prepare(
      `SELECT id
       FROM submitted_cases
       WHERE response_id = ?
       LIMIT 1`,
    )
    .bind(responseId)
    .first<{ id: number }>();
  return Boolean(row);
}

export async function deleteExpiredCases(
  db: AnalyticsDatabase,
  now = Date.now(),
) {
  return db
    .prepare("DELETE FROM submitted_cases WHERE delete_after <= ?")
    .bind(now)
    .run();
}

export async function recordInteractionForCase(
  db: AnalyticsDatabase,
  record: Omit<InteractionRecord, "eventType" | "reason">,
) {
  return recordInteraction(db, {
    ...record,
    eventType: "case_submit",
    reason: null,
    reasonDetail: null,
  });
}

async function bestEffort(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    console.error("Anonymous analytics write failed:", error instanceof Error ? error.message : "unknown");
  }
}

export function recordGenerationSafely(
  db: AnalyticsDatabase | null | undefined,
  record: GenerationRecord,
) {
  return bestEffort(() => (db ? recordGeneration(db, record) : Promise.resolve()));
}

export function recordInteractionSafely(
  db: AnalyticsDatabase | null | undefined,
  record: InteractionRecord,
) {
  return bestEffort(() => (db ? recordInteraction(db, record) : Promise.resolve()));
}

export function recordSubmittedCaseSafely(
  db: AnalyticsDatabase | null | undefined,
  record: SubmittedCaseRecord,
) {
  return bestEffort(() => (db ? recordSubmittedCase(db, record) : Promise.resolve()));
}
