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
  assert.equal(isNegativeReason("unclear_explanation"), true);
  assert.equal(isNegativeReason("unnatural_plain"), true);
  assert.equal(isNegativeReason("missed_subtext"), true);
  assert.equal(isNegativeReason("overinterpreted"), true);
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
  assert.match(page, /placeholder=\{activeFeedback\.otherPlaceholder\}/);
  assert.match(page, /otherPlaceholder:\s*"请具体说明哪里不合适"/);
  assert.match(page, /otherPlaceholder:\s*"请具体说明哪里释得不准"/);
});

test("feedback success renders one thank-you message", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal(page.match(/感谢反馈，礼官已记下。/g)?.length, 1);
});

test("feedback UI derives labels and reasons from the active direction", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const feedbackConfigs/);
  assert.match(page, /positiveLabel:\s*"👍 合乎周礼"/);
  assert.match(page, /negativeLabel:\s*"👎 不够周礼"/);
  assert.match(page, /positiveLabel:\s*"👍 释得明白"/);
  assert.match(page, /negativeLabel:\s*"👎 释得不准"/);
  assert.match(page, /id:\s*"unclear_explanation",\s*label:\s*"还是没说清"/);
  assert.match(page, /id:\s*"unnatural_plain",\s*label:\s*"不像日常人话"/);
  assert.match(page, /id:\s*"missed_subtext",\s*label:\s*"漏掉潜台词"/);
  assert.match(page, /id:\s*"overinterpreted",\s*label:\s*"过度解读"/);
  assert.match(page, /const activeFeedback = feedbackConfigs\[direction\]/);
  assert.match(page, /\{activeFeedback\.positiveLabel\}/);
  assert.match(page, /\{activeFeedback\.negativeLabel\}/);
  assert.match(page, /activeFeedback\.reasons\.map/);
});

test("generation analytics distinguish ask and explain modes", () => {
  const route = readFileSync(
    new URL("../app/api/translate/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    route,
    /mode:\s*direction === "to_plain"\s*\?\s*`to_plain:\$\{plainMode\}`\s*:\s*`to_zhouli:\$\{mode\}`/,
  );
});

test("feedback UI uses the full serif font without per-character fallback", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const selectors = [
    /\.feedback-thanks,\s*\.feedback-message/,
    /\.negative-reasons p,\s*\.case-consent p/,
    /\.negative-reasons textarea/,
    /\.case-submit-link/,
    /\.case-consent strong/,
  ];

  for (const selector of selectors) {
    const rule = styles.match(new RegExp(`${selector.source}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? "";
    assert.match(rule, /var\(--serif-dynamic\)/, `${selector.source} must use the full font`);
    assert.doesNotMatch(rule, /var\(--serif\)/, `${selector.source} must not use the UI subset`);
  }
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

test("clients leave each generation assignment to the Worker", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(
    new URL("../app/api/translate/route.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(page, /zhouli-experiment-bucket/);
  assert.doesNotMatch(page, /experiment_bucket/);
  assert.doesNotMatch(route, /body\.experiment_bucket/);
  assert.doesNotMatch(route, /parseExperimentBucket/);
  assert.match(route, /selectRandomExperimentVariant\(analyticsConfig\)/);
});
