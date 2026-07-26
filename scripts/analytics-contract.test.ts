import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_ANALYTICS_CONFIG,
  getAnalyticsConfig,
  isClientSurface,
  isEventType,
  isNegativeReason,
  isReleaseChannel,
  validateAnalyticsMeta,
} from "../lib/analytics.ts";

test("accepts only the two public client surfaces", () => {
  assert.equal(isClientSurface("web"), true);
  assert.equal(isClientSurface("bilibili_toy"), true);
  assert.equal(isClientSurface("https://example.com"), false);
  assert.equal(isClientSurface("web:user-123"), false);
});

test("accepts only documented release channels, events, and reasons", () => {
  assert.equal(isReleaseChannel("production"), true);
  assert.equal(isReleaseChannel("preview"), true);
  assert.equal(isReleaseChannel("development"), true);
  assert.equal(isReleaseChannel("staging"), false);
  assert.equal(isEventType("copy"), true);
  assert.equal(isEventType("case_submit"), true);
  assert.equal(isEventType("delete_user"), false);
  assert.equal(isNegativeReason("meaning_drift"), true);
  assert.equal(isNegativeReason("ip_address"), false);
});

test("validates bounded client analytics metadata without identifying a user", () => {
  assert.deepEqual(
    validateAnalyticsMeta({
      surface: "web",
      client_version: "web-2026.07.27",
      release_channel: "production",
    }),
    {
      surface: "web",
      clientVersion: "web-2026.07.27",
      releaseChannel: "production",
    },
  );
  assert.equal(
    validateAnalyticsMeta({
      surface: "https://hehuzhouli.com",
      client_version: "web-2026.07.27",
      release_channel: "production",
    }),
    null,
  );
  assert.equal(
    validateAnalyticsMeta({
      surface: "web",
      client_version: "user@example.com",
      release_channel: "production",
    }),
    null,
  );
});

test("uses disabled and conservative defaults", () => {
  assert.deepEqual(getAnalyticsConfig({}), DEFAULT_ANALYTICS_CONFIG);
  assert.deepEqual(
    getAnalyticsConfig({
      ANALYTICS_ENABLED: "true",
      FEEDBACK_UI_ENABLED: "true",
      CASE_SUBMISSION_ENABLED: "true",
      AB_TEST_ENABLED: "true",
      AB_TEST_B_PERCENT: "50",
      PROMPT_VERSION_A: "zhouli-v1",
      PROMPT_VERSION_B: "zhouli-v2",
    }),
    {
      analyticsEnabled: true,
      feedbackUiEnabled: true,
      caseSubmissionEnabled: true,
      abTestEnabled: true,
      abTestBPercent: 50,
      promptVersionA: "zhouli-v1",
      promptVersionB: "zhouli-v2",
    },
  );
});

test("migration defines only aggregate generation fields and retention-aware cases", () => {
  const migration = readFileSync(
    new URL("../migrations/0001_create_analytics.sql", import.meta.url),
    "utf8",
  );
  const generationsTable = migration.match(
    /CREATE TABLE generations \(([\s\S]*?)\n\);/i,
  )?.[1] ?? "";

  assert.match(generationsTable, /response_id TEXT PRIMARY KEY/);
  assert.match(migration, /CREATE TABLE interactions/);
  assert.match(migration, /CREATE TABLE submitted_cases/);
  assert.match(migration, /delete_after INTEGER NOT NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX .*quality/i);
  assert.doesNotMatch(generationsTable, /input_text TEXT/i);
  assert.doesNotMatch(generationsTable, /output_text TEXT/i);
});

test("feedback UI sends custom detail for the other reason", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /feedbackOtherReason/);
  assert.match(page, /reason_detail/);
  assert.match(page, /placeholder=.*具体说明/);
});

test("feedback success renders one thank-you message", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal(page.match(/感谢反馈，礼官已记下。/g)?.length, 1);
});

test("feedback status uses the full serif font without per-character fallback", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const rule =
    styles.match(
      /\.feedback-thanks,\s*\.feedback-message\s*\{([\s\S]*?)\}/,
    )?.[1] ?? "";

  assert.match(rule, /font:\s*400 11px\/1\.6 var\(--serif-dynamic\)/);
});

test("negative feedback exposes a prominent case submission action", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const rule = styles.match(/\.case-submit-link\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(page, /<span>愿意提交本次输入和结果，帮助改进<\/span>/);
  assert.match(page, /<Icon name="arrow" \/>/);
  assert.match(rule, /display:\s*flex/);
  assert.match(rule, /width:\s*100%/);
  assert.match(rule, /min-height:\s*44px/);
  assert.match(rule, /justify-content:\s*space-between/);
});

test("accepted cases do not expose the submission action again", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const \[caseSubmitted, setCaseSubmitted\] = useState\(false\)/);
  assert.match(page, /setCaseSubmitted\(true\)/);
  assert.match(
    page,
    /feedbackSubmitted && feedbackReasons\.length > 0 && !caseSubmitted && !showCaseConsent && feedbackToken/,
  );
});
