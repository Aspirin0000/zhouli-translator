import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics.ts";
import {
  getPromptSet,
  selectExperimentVariant,
} from "../lib/prompt-variants.ts";
import {
  buildPlainPrompt,
  buildUserPrompt,
  PLAIN_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from "../lib/prompt.ts";

const enabledConfig = {
  ...DEFAULT_ANALYTICS_CONFIG,
  abTestEnabled: true,
  abTestBPercent: 50,
  promptVersionB: "zhouli-v4",
};

const retiredHardRules =
  /可逆主句|总共只写两句|逐字输出|必须连续保留|原样保留|以原问句收尾/u;

test("experiment assignment is deterministic for a supplied bucket", () => {
  assert.equal(selectExperimentVariant(enabledConfig, 10), "B");
  assert.equal(selectExperimentVariant(enabledConfig, 60), "A");
  assert.equal(selectExperimentVariant(enabledConfig, undefined), "A");
});

test("disabled experiments keep the current prompt", () => {
  const prompts = getPromptSet("to_plain", "B", DEFAULT_ANALYTICS_CONFIG);
  assert.equal(prompts.promptVersion, "zhouli-v1");
  assert.equal(prompts.variant, "A");
});

test("variant A continues to use the established ask prompt", () => {
  const input = {
    text: "老板说年轻人要多吃苦，我该怎样温言相劝",
    mode: "gentle" as const,
    level: "light" as const,
  };
  const prompts = getPromptSet("to_zhouli", "A", enabledConfig, input);

  assert.equal(prompts.systemPrompt, SYSTEM_PROMPT);
  assert.equal(
    prompts.userPrompt,
    buildUserPrompt(input.text, input.mode, input.level),
  );
});

test("variant A continues to use the established explain prompt", () => {
  const input = {
    text: "我听闻，今日腹中空空，礼数也抵不过一顿饭。",
    level: "light" as const,
    plainMode: "direct" as const,
  };
  const prompts = getPromptSet("to_plain", "A", enabledConfig, input);

  assert.equal(prompts.systemPrompt, PLAIN_SYSTEM_PROMPT);
  assert.equal(
    prompts.userPrompt,
    buildPlainPrompt(input.text, input.level, input.plainMode),
  );
});

test("variant B is a compact ask extension of A", () => {
  const input = {
    text: "老板说年轻人要多吃苦，我该怎样温言相劝",
    mode: "gentle" as const,
    level: "light" as const,
  };
  const a = getPromptSet("to_zhouli", "A", enabledConfig, input);
  const b = getPromptSet("to_zhouli", "B", enabledConfig, input);

  assert.equal(b.variant, "B");
  assert.equal(b.promptVersion, "zhouli-v4");
  assert.ok(b.systemPrompt.startsWith(`${a.systemPrompt}\n\n`));
  assert.equal(b.userPrompt, a.userPrompt);
  assert.ok(b.systemPrompt.length - a.systemPrompt.length < 700);
  assert.match(b.systemPrompt, /说话者、对象/u);
  assert.match(b.systemPrompt, /不确定时/u);
  assert.match(b.systemPrompt, /不另起一套模板/u);
  assert.doesNotMatch(
    b.systemPrompt.slice(a.systemPrompt.length),
    retiredHardRules,
  );
});

test("variant B is a compact explain extension of A", () => {
  const input = {
    text: "我听闻，此事或有转机，只是不知该如何开口相求。",
    level: "standard" as const,
    plainMode: "subtext" as const,
  };
  const a = getPromptSet("to_plain", "A", enabledConfig, input);
  const b = getPromptSet("to_plain", "B", enabledConfig, input);

  assert.equal(b.variant, "B");
  assert.equal(b.promptVersion, "zhouli-v4");
  assert.ok(b.systemPrompt.startsWith(`${a.systemPrompt}\n\n`));
  assert.equal(b.userPrompt, a.userPrompt);
  assert.ok(b.systemPrompt.length - a.systemPrompt.length < 500);
  assert.match(b.systemPrompt, /人称、对象/u);
  assert.match(b.systemPrompt, /不确定时/u);
  assert.match(b.systemPrompt, /不另起一套模板/u);
  assert.doesNotMatch(
    b.systemPrompt.slice(a.systemPrompt.length),
    retiredHardRules,
  );
});

test("variant B keeps A's full rewrite request instead of extracting a new task", () => {
  const input = {
    text: "将“今年你会更新漫画吗”转化成周礼体",
    mode: "debate" as const,
    level: "light" as const,
  };
  const a = getPromptSet("to_zhouli", "A", enabledConfig, input);
  const b = getPromptSet("to_zhouli", "B", enabledConfig, input);

  assert.equal(b.userPrompt, a.userPrompt);
  assert.match(b.userPrompt, /将“今年你会更新漫画吗”转化成周礼体/u);
  assert.doesNotMatch(b.userPrompt, /实验 B 本次语义契约/u);
});
