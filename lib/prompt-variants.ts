import {
  buildPlainPrompt,
  buildUserPrompt,
  PLAIN_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  type PlainMode,
  type ZhouliDirection,
  type ZhouliLevel,
  type ZhouliMode,
} from "./prompt.ts";
import type { AnalyticsConfig } from "./analytics.ts";

export type PromptVariant = "A" | "B";

const ZHOULI_VARIANT_B_SYSTEM_PROMPT = SYSTEM_PROMPT.replace(
  "需要古风依据时，改写成“若按礼法来看”“古人会觉得”“我听闻有这样一个道理”“我听说从前有个贤人，他遇到过一件事……”这类明显是讲故事的白话。",
  "明确人物、篇名或引文只有确认可靠时才使用；不确定时仍写成“若按礼法来看”“古人会觉得”“我听闻有这样一个道理”“我听说从前有个人，他遇到过一件事……”这类泛化旧事。",
).replace(
  "可以加比喻，但不能新增事实、不能更换对象、不能把请求变成判断、不能把吐槽变成夸奖。",
  "可以加比喻，但比喻仍只是类比，不当作原话事实；不能更换对象、不能把请求变成回答或判断、不能把吐槽变成夸奖。",
);

const PLAIN_VARIANT_B_SYSTEM_PROMPT = PLAIN_SYSTEM_PROMPT.replace(
  "6. 遇到不确定的典故或明显胡编的旧事，不要把它当真，只提炼它服务的观点。",
  "6. 遇到不确定的典故或明显胡编的旧事，先当作风格包装，只提炼有文本依据的观点，不把故事细节当成事实。",
);

export function selectExperimentVariant(
  config: AnalyticsConfig,
  bucket: number | undefined,
): PromptVariant {
  if (!config.abTestEnabled || config.abTestBPercent <= 0) return "A";
  if (config.abTestBPercent >= 100) return "B";
  if (
    bucket === undefined ||
    !Number.isInteger(bucket) ||
    bucket < 0 ||
    bucket > 99
  ) {
    return "A";
  }
  return bucket < config.abTestBPercent ? "B" : "A";
}

export function selectRandomExperimentVariant(
  config: AnalyticsConfig,
  random: () => number = Math.random,
): PromptVariant {
  if (!config.abTestEnabled) return "A";
  const bucket = Math.min(99, Math.max(0, Math.floor(random() * 100)));
  return selectExperimentVariant(config, bucket);
}

export function getPromptSet(
  direction: ZhouliDirection,
  requestedVariant: PromptVariant,
  config: AnalyticsConfig,
  input?: {
    text?: string;
    mode?: ZhouliMode;
    level?: ZhouliLevel;
    plainMode?: PlainMode;
  },
) {
  const variant = config.abTestEnabled ? requestedVariant : "A";
  const isPlain = direction === "to_plain";
  const systemPrompt = isPlain ? PLAIN_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const sourceText = input?.text ?? "";
  const userPrompt = isPlain
    ? sourceText && input?.level && input.plainMode
      ? buildPlainPrompt(sourceText, input.level, input.plainMode)
      : ""
    : sourceText && input?.level && input.mode
      ? buildUserPrompt(sourceText, input.mode, input.level)
      : "";

  return {
    variant,
    promptVersion:
      variant === "B" ? config.promptVersionB : config.promptVersionA,
    systemPrompt:
      variant === "B"
        ? isPlain
          ? PLAIN_VARIANT_B_SYSTEM_PROMPT
          : ZHOULI_VARIANT_B_SYSTEM_PROMPT
        : systemPrompt,
    userPrompt,
  };
}
