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

const ZHOULI_VARIANT_B_GUIDANCE = `实验 B 精度倾向：
- 保持上述风格、起手、结构和篇幅习惯，不另起一套模板。
- 润色前先核对说话者、对象、动作、时间、条件、否定、疑问和褒贬，再完成原有的周礼式说理。
- 少补原文没有的动机、关系、经历和现实事实；有多种理解时，优先选择最直接、最少增义的一种。
- 典故与旧事以可靠为先；不确定时，沿用上述泛化旧事，不补精确引文、篇名、人物原话或历史细节。`;

const PLAIN_VARIANT_B_GUIDANCE = `实验 B 精度倾向：
- 保持上述释礼口吻、结构和篇幅习惯，不另起一套模板。
- 先核对人称、对象、动作、条件、否定、疑问、不确定性和褒贬，再做口语化。
- 只解释原文有依据的意思；不确定时保留余地，不擅自增加动机、指控或道德判断。`;

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
        ? `${systemPrompt}\n\n${
            isPlain
              ? PLAIN_VARIANT_B_GUIDANCE
              : ZHOULI_VARIANT_B_GUIDANCE
          }`
        : systemPrompt,
    userPrompt,
  };
}
