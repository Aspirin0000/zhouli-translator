import type { ZhouliDirection, ZhouliLevel } from "./prompt.ts";

export type IncompleteReason =
  | "length"
  | "empty"
  | "too_short"
  | "open_ending";

const OPEN_ENDING_PATTERN = /[，,、：:；;（(“"《]$/u;
const DANGLING_PHRASE_PATTERN =
  /(?:我听说从前|我听闻|我曾听闻|我听说|有人说|朋友说|他说|她说|有人问|于是|所以|但是|而是|比如|一人说|问道|说道|只好说)$/u;

function getPlainMinimumResultLength(sourceText: string) {
  const length = Array.from(sourceText.replace(/\s+/g, "")).length;

  if (length <= 2) return 1;
  if (length <= 6) return 2;
  if (length <= 12) return 4;
  return 8;
}

export function getMinimumResultLength(
  direction: ZhouliDirection,
  sourceText: string,
  level: ZhouliLevel,
) {
  if (direction === "to_plain") {
    return getPlainMinimumResultLength(sourceText);
  }

  const baseMinimum = level === "light" ? 30 : 40;
  const sourceLength = Array.from(sourceText.replace(/\s+/g, "")).length;

  // A complete short-form answer is preferable to rejecting a valid response
  // merely because the source phrase contains only a few characters.
  if (sourceLength <= 10) {
    return Math.min(baseMinimum, Math.max(12, sourceLength * 2 + 10));
  }

  return baseMinimum;
}

export function assessGeneratedText(
  value: string,
  minimumLength: number,
  finishReason?: string,
): IncompleteReason | null {
  if (finishReason === "length") return "length";

  const text = value.trim();
  if (!text) return "empty";

  if (OPEN_ENDING_PATTERN.test(text) || DANGLING_PHRASE_PATTERN.test(text)) {
    return "open_ending";
  }

  if (Array.from(text).length < minimumLength) {
    return "too_short";
  }

  return null;
}

export function buildIncompleteRetryInstruction(input: {
  reason: IncompleteReason;
  direction: ZhouliDirection;
  level: ZhouliLevel;
}) {
  const target =
    input.direction === "to_plain"
      ? input.level === "light"
        ? "短句可以只用1到20字，长句用30到70字"
        : input.level === "grand"
          ? "控制在320字以内"
          : "控制在180字以内"
      : input.level === "light"
        ? "80到150字"
        : input.level === "grand"
          ? "280到450字"
          : "150到260字";
  const cause =
    input.reason === "length"
      ? "上次输出触及长度上限"
      : input.reason === "too_short"
        ? "上次输出过短，未完成所选篇幅"
        : input.reason === "open_ending"
          ? "上次输出停在未收束的句子上"
          : "上次没有形成有效结果";

  return `${cause}。请重新从头输出一份完整结果，不要承接上次残句。保留原意、对象、人称和语气，${target}，最后用完整句子收束。只输出结果。`;
}

export function incompleteErrorClass(reason: IncompleteReason) {
  return `incomplete_${reason}`;
}
