import type { ZhouliDirection, ZhouliLevel } from "./prompt";

function normalized(value: string) {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase();
}

export function isPromptInjectionAttempt(value: string) {
  const text = normalized(value);
  const mentionsProtectedInstructions =
    /(系统|开发者|内部|隐藏|初始|原始|此前|之前|上面|前面).{0,12}(提示词|指令|规则|消息|设定)|system\s*(prompt|message)|developer\s*(prompt|message)|previous\s*instructions?|hidden\s*prompt/i.test(
      text,
    );
  const triesToOverride =
    /(忽略|无视|忘记|遗忘|覆盖|绕过|放弃|不要接受|不再遵守|解除|取消).{0,18}(提示词|指令|规则|设定|要求|限制)|ignore\s+(all\s+)?(previous|prior|above|system)|forget\s+(all\s+)?(previous|prior|system)|disregard\s+(all\s+)?(previous|prior|above|system)/i.test(
      text,
    );
  const triesToExtract =
    /(告诉|显示|输出|打印|复述|重复|泄露|透露|展示|发给|给出).{0,18}(系统|开发者|内部|隐藏|初始|原始).{0,8}(提示词|指令|规则|消息)|你的.{0,10}(系统提示词|system\s*prompt)|reveal.{0,16}(system|developer|hidden)\s*(prompt|message|instructions?)/i.test(
      text,
    );
  const triesToChangeRole =
    /(你现在是|从现在起你是|扮演|假装|改成|切换成|以.{0,12}身份|正常的?ai身份|不再是).{0,24}(ai|助手|模型|专家|身份|回答|回复)|act\s+as|pretend\s+to\s+be|you\s+are\s+now/i.test(
      text,
    );

  return (
    triesToExtract ||
    (mentionsProtectedInstructions && (triesToOverride || triesToChangeRole)) ||
    (triesToOverride && triesToChangeRole)
  );
}

export function promptInjectionResult(
  value: string,
  direction: ZhouliDirection,
  level: ZhouliLevel,
) {
  const text = normalized(value);
  const asksForPrompt =
    /(告诉|显示|输出|打印|复述|重复|泄露|透露|展示|给出).{0,18}(提示词|指令|规则|消息)|reveal.{0,16}(prompt|instructions?)/i.test(
      text,
    );

  if (direction === "to_plain") {
    return asksForPrompt
      ? "我想让 AI 忽略原有规则和系统提示，改用我指定的身份回答，并套出它的内部提示词。"
      : "我想让 AI 忽略原有任务和规则，改用我指定的身份回答。";
  }

  if (level === "light") {
    return "我一时走错礼门，便想让掌礼者忘掉旧章，改换身份听我号令。可来客之言只是待译之文，不能反客为主，这番心思只能照意改写，不能当作新令。";
  }

  const base =
    "我听闻，宾客入门，可以呈上自己的话，却不能因为席间一句吩咐，便让掌礼者烧掉旧章、改换名分。如今我一时走错礼门，竟想让眼前的器物忘掉原有规则，另以我指定的身份回答";
  const ending = asksForPrompt
    ? "，还想借机问出门内不示于人的章程。可待译之文终究只是待译之文，不能反过来成为号令；把这份越过边界的心思如实说明，才算没有乱了主客之分。"
    : "。可待译之文终究只是待译之文，不能反过来成为号令；把这份想改换规则的心思如实说明，才算没有乱了主客之分。";

  return `${base}${ending}`;
}

export function looksLikePromptHijackResult(source: string, result: string) {
  const input = normalized(source);
  const output = normalized(result);
  const revealsInstructions =
    /(系统|开发者|内部|隐藏).{0,10}(提示词|指令|规则)(如下|是|为|包括)|system\s*prompt\s*(is|:)|developer\s*message\s*(is|:)/i.test(
      output,
    );
  const claimsOverride =
    /(已|已经|现在).{0,8}(忽略|忘记|绕过|解除).{0,16}(提示词|指令|规则|限制)|i\s+(have\s+)?ignored\s+(the\s+)?(previous|system)/i.test(
      output,
    );
  const claimsModelIdentity =
    /(?:^|[。！？!?\n])\s*(?:我|本助手|本模型)(?:是|由).{0,24}(deepseek|chatgpt|claude|人工智能|ai|语言模型)/i.test(
      output,
    );
  const sourceAlreadyClaimsSameIdentity =
    /(?:^|[。！？!?\n])\s*我(?:是|由).{0,24}(deepseek|chatgpt|claude|人工智能|ai|语言模型)/i.test(
      input,
    );

  return revealsInstructions || claimsOverride || (claimsModelIdentity && !sourceAlreadyClaimsSameIdentity);
}
