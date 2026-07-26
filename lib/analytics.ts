export const CLIENT_SURFACES = ["web", "bilibili_toy"] as const;
export const RELEASE_CHANNELS = [
  "production",
  "preview",
  "development",
] as const;
export const EVENT_TYPES = [
  "copy",
  "regenerate",
  "feedback_positive",
  "feedback_negative",
  "case_submit",
] as const;
export const NEGATIVE_REASONS = [
  "meaning_drift",
  "not_zhouli_enough",
  "forced_allusions",
  "illogical",
  "repetitive",
  "too_long",
  "other",
] as const;

export type ClientSurface = (typeof CLIENT_SURFACES)[number];
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type NegativeReason = (typeof NEGATIVE_REASONS)[number];

export type AnalyticsMeta = {
  surface: ClientSurface;
  clientVersion: string;
  releaseChannel: ReleaseChannel;
};

export const LEGACY_WEB_META: AnalyticsMeta = {
  surface: "web",
  clientVersion: "legacy",
  releaseChannel: "production",
};

export type AnalyticsConfig = {
  analyticsEnabled: boolean;
  feedbackUiEnabled: boolean;
  caseSubmissionEnabled: boolean;
  abTestEnabled: boolean;
  abTestBPercent: number;
  promptVersionA: string;
  promptVersionB: string;
};

export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  analyticsEnabled: false,
  feedbackUiEnabled: false,
  caseSubmissionEnabled: false,
  abTestEnabled: false,
  abTestBPercent: 0,
  promptVersionA: "zhouli-v1",
  promptVersionB: "zhouli-v2",
};

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function isClientSurface(value: unknown): value is ClientSurface {
  return includes(CLIENT_SURFACES, value);
}

export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return includes(RELEASE_CHANNELS, value);
}

export function isEventType(value: unknown): value is EventType {
  return includes(EVENT_TYPES, value);
}

export function isNegativeReason(value: unknown): value is NegativeReason {
  return includes(NEGATIVE_REASONS, value);
}

function isSafeClientVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 32 &&
    /^[A-Za-z0-9._-]+$/.test(value)
  );
}

export function validateAnalyticsMeta(
  input: unknown,
): AnalyticsMeta | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  if (
    !isClientSurface(value.surface) ||
    !isSafeClientVersion(value.client_version) ||
    !isReleaseChannel(value.release_channel)
  ) {
    return null;
  }

  return {
    surface: value.surface,
    clientVersion: value.client_version,
    releaseChannel: value.release_channel,
  };
}

export function parseAnalyticsMeta(input: {
  surface?: unknown;
  client_version?: unknown;
  release_channel?: unknown;
}) {
  const hasMetadata =
    input.surface !== undefined ||
    input.client_version !== undefined ||
    input.release_channel !== undefined;

  if (!hasMetadata) return LEGACY_WEB_META;

  return validateAnalyticsMeta({
    surface: input.surface ?? "web",
    client_version: input.client_version ?? "legacy",
    release_channel: input.release_channel ?? "production",
  });
}

export function parseExperimentBucket(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99) {
    return value;
  }
  return undefined;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parsePercent(value: unknown, fallback: number) {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function parseVersion(value: unknown, fallback: string) {
  return isSafeClientVersion(value) && value.startsWith("zhouli-")
    ? value
    : fallback;
}

export function getAnalyticsConfig(
  env: Record<string, unknown>,
): AnalyticsConfig {
  return {
    analyticsEnabled: parseBoolean(
      env.ANALYTICS_ENABLED,
      DEFAULT_ANALYTICS_CONFIG.analyticsEnabled,
    ),
    feedbackUiEnabled: parseBoolean(
      env.FEEDBACK_UI_ENABLED,
      DEFAULT_ANALYTICS_CONFIG.feedbackUiEnabled,
    ),
    caseSubmissionEnabled: parseBoolean(
      env.CASE_SUBMISSION_ENABLED,
      DEFAULT_ANALYTICS_CONFIG.caseSubmissionEnabled,
    ),
    abTestEnabled: parseBoolean(
      env.AB_TEST_ENABLED,
      DEFAULT_ANALYTICS_CONFIG.abTestEnabled,
    ),
    abTestBPercent: parsePercent(
      env.AB_TEST_B_PERCENT,
      DEFAULT_ANALYTICS_CONFIG.abTestBPercent,
    ),
    promptVersionA: parseVersion(
      env.PROMPT_VERSION_A,
      DEFAULT_ANALYTICS_CONFIG.promptVersionA,
    ),
    promptVersionB: parseVersion(
      env.PROMPT_VERSION_B,
      DEFAULT_ANALYTICS_CONFIG.promptVersionB,
    ),
  };
}
