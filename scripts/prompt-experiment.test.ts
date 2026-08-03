import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ANALYTICS_CONFIG } from "../lib/analytics.ts";
import {
  getPromptSet,
  selectExperimentVariant,
  selectRandomExperimentVariant,
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
  /实验 B|可逆主句|总共只写两句|逐字输出|必须连续保留|以原问句收尾|第二人称“你”通常是收话者|请求或问句仍由原说话者提出|不要代替收话者回答|故事和比喻只服务原意/u;

test("experiment assignment is deterministic for a supplied bucket", () => {
  assert.equal(selectExperimentVariant(enabledConfig, 10), "B");
  assert.equal(selectExperimentVariant(enabledConfig, 60), "A");
  assert.equal(selectExperimentVariant(enabledConfig, undefined), "A");
});

test("each enabled assignment uses the current random draw", () => {
  const draws = [0.01, 0.99];
  const random = () => draws.shift() ?? 0.5;

  assert.equal(selectRandomExperimentVariant(enabledConfig, random), "B");
  assert.equal(selectRandomExperimentVariant(enabledConfig, random), "A");
  assert.equal(draws.length, 0);
});

test("disabled assignment stays on A without drawing randomness", () => {
  let draws = 0;
  const variant = selectRandomExperimentVariant(
    DEFAULT_ANALYTICS_CONFIG,
    () => {
      draws += 1;
      return 0;
    },
  );

  assert.equal(variant, "A");
  assert.equal(draws, 0);
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

test("variant B makes only localized edits inside A's ask prompt", () => {
  const input = {
    text: "老板说年轻人要多吃苦，我该怎样温言相劝",
    mode: "gentle" as const,
    level: "light" as const,
  };
  const a = getPromptSet("to_zhouli", "A", enabledConfig, input);
  const b = getPromptSet("to_zhouli", "B", enabledConfig, input);

  assert.equal(b.variant, "B");
  assert.equal(b.promptVersion, "zhouli-v4");
  assert.equal(b.userPrompt, a.userPrompt);
  assert.notEqual(b.systemPrompt, a.systemPrompt);
  assert.ok(Math.abs(b.systemPrompt.length - a.systemPrompt.length) < 160);
  assert.ok(
    b.systemPrompt.startsWith(
      a.systemPrompt.slice(0, a.systemPrompt.indexOf("14. 严禁伪装")),
    ),
  );
  assert.match(b.systemPrompt, /明确人物、篇名或引文/u);
  assert.match(b.systemPrompt, /比喻仍只是类比/u);
  assert.match(b.systemPrompt, /不能把请求变成回答或判断/u);
  assert.doesNotMatch(b.systemPrompt, retiredHardRules);
});

test("variant B makes only a localized edit inside A's explain prompt", () => {
  const input = {
    text: "我听闻，此事或有转机，只是不知该如何开口相求。",
    level: "standard" as const,
    plainMode: "subtext" as const,
  };
  const a = getPromptSet("to_plain", "A", enabledConfig, input);
  const b = getPromptSet("to_plain", "B", enabledConfig, input);

  assert.equal(b.variant, "B");
  assert.equal(b.promptVersion, "zhouli-v4");
  assert.equal(b.userPrompt, a.userPrompt);
  assert.notEqual(b.systemPrompt, a.systemPrompt);
  assert.ok(Math.abs(b.systemPrompt.length - a.systemPrompt.length) < 80);
  assert.ok(
    b.systemPrompt.startsWith(
      a.systemPrompt.slice(0, a.systemPrompt.indexOf("6. 遇到不确定的典故")),
    ),
  );
  assert.match(b.systemPrompt, /先当作风格包装/u);
  assert.match(b.systemPrompt, /不把故事细节当成事实/u);
  assert.doesNotMatch(b.systemPrompt, retiredHardRules);
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
