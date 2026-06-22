import { NextRequest, NextResponse } from "next/server";
import {
  buildUserPrompt,
  SYSTEM_PROMPT,
  type ZhouliLevel,
  type ZhouliMode,
} from "@/lib/prompt";

export const runtime = "nodejs";

const VALID_MODES = new Set<ZhouliMode>([
  "gentle",
  "debate",
  "defend",
  "lament",
]);
const VALID_LEVELS = new Set<ZhouliLevel>(["light", "standard", "grand"]);

type RateRecord = {
  windowStartedAt: number;
  count: number;
  day: string;
  dayCount: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  zhouliRateLimit?: Map<string, RateRecord>;
};

const rateLimit = globalForRateLimit.zhouliRateLimit ?? new Map();
globalForRateLimit.zhouliRateLimit = rateLimit;

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  const clientId = request.headers.get("x-client-id") || "anonymous";
  return `${ip}:${clientId.slice(0, 80)}`;
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const current = rateLimit.get(key);

  if (!current || current.day !== today) {
    rateLimit.set(key, {
      windowStartedAt: now,
      count: 1,
      day: today,
      dayCount: 1,
    });
    return { allowed: true, remaining: 59 };
  }

  if (now - current.windowStartedAt > 10 * 60 * 1000) {
    current.windowStartedAt = now;
    current.count = 0;
  }

  if (current.count >= 12 || current.dayCount >= 60) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  current.dayCount += 1;
  rateLimit.set(key, current);
  return { allowed: true, remaining: Math.max(0, 60 - current.dayCount) };
}

function demoResult(text: string, mode: ZhouliMode, level: ZhouliLevel) {
  const subject = text.replace(/[。！？!?]+$/g, "");
  const openings: Record<ZhouliMode, string> = {
    gentle:
      "我听说，古代有贤德的人，在与朋友相处的时候，从不会因为一时的言语就忘记彼此长久的情分。",
    debate:
      "我听说，判断一件事情是否合乎礼，不能只看它表面的样子，还要看它最后使人得到了什么。",
    defend:
      "有人认为这件事不够稳妥，我却不这样看。古代的君子并不是从不犯错，而是懂得给每一种行为找到合适的名分。",
    lament:
      "从前的人把细小的事情看得很重，因为他们知道，礼法的败坏往往不是从朝堂开始，而是从一次漫不经心开始。",
  };

  const endings: Record<ZhouliMode, string> = {
    gentle:
      "如今既然事情已经发生，与其急着责怪，不如把话说明白、把情分留下。能够让彼此体面，难道不也是一种合乎周礼的做法吗？",
    debate:
      "这样看来，真正需要讨论的不是这句话听起来是否漂亮，而是它有没有让事情变得更好。若能如此，它离君子之言也就不远了。",
    defend:
      "所以这件事看似随意，实际上既保全了自己的本心，也没有损害别人。能够两全其美，怎么能说它完全不合乎周礼呢？",
    lament:
      `而现在竟有人说出“${subject}”，却不曾想过一句话也有它应当承担的分量。长此以往，人与人之间还凭什么相信彼此呢？`,
  };

  const middle =
    level === "light"
      ? `现在有人说“${subject}”，这句话虽然寻常，其中却也有可以体谅的地方。`
      : `当年有人行路匆忙，仍会在经过长者身旁时放慢脚步，不是因为道路难走，而是因为他知道自己的方便，不该成为别人的冒犯。现在有人说“${subject}”，表面看只是随口一说，其实也应当看看这句话落在别人心里，会有怎样的分量。`;

  return `${openings[mode]}${middle}${endings[mode]}`;
}

function cleanGeneratedText(value: string) {
  return value
    .replace(
      /(?:我听说)?(?:从前|当年|古时候|古代)?有(?:一位|一个|位|个)?(?:贤人|贤者|长者)[^。！？!?]{0,10}(?:说过|讲过)[，,：:]*/g,
      "我听说从前有个贤人，",
    )
    .replace(/(?:圣人|古人|孔子|周公)(?:云|曰|说)[，,：:]*/g, "若按礼法来看，")
    .replace(/《[^》]{1,12}》(?:所言|有云|曰|云|说|记载)[，,：:]*/g, "若按礼法来看，")
    .replace(/这正是我担忧的啊[，,。！？!?]*/g, "")
    .replace(/(?:你且想想|你好好想想|仔细想想)(?:其中的道理)?[，,、：:]*/g, "")
    .replace(/这其中的道理[，,、：:]*/g, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  const key = getClientKey(request);
  const rate = checkRateLimit(key);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "今日问礼已多，请稍候再来。" },
      { status: 429 },
    );
  }

  let body: {
    text?: unknown;
    mode?: unknown;
    level?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "来意未明，请重新输入。" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mode = VALID_MODES.has(body.mode as ZhouliMode)
    ? (body.mode as ZhouliMode)
    : "gentle";
  const level = VALID_LEVELS.has(body.level as ZhouliLevel)
    ? (body.level as ZhouliLevel)
    : "standard";

  if (!text) {
    return NextResponse.json({ error: "无言不可成礼，请先写下一句话。" }, { status: 400 });
  }

  if (text.length > 300) {
    return NextResponse.json(
      { error: "言多则礼繁，请将原话控制在300字以内。" },
      { status: 400 },
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      result: demoResult(text, mode, level),
      model: "本地演示",
      demo: true,
      remaining: rate.remaining,
    });
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(text, mode, level) },
        ],
        max_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 720),
        temperature: 0.9,
        stream: false,
        thinking: { type: "disabled" },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DeepSeek API error:", data);
      return NextResponse.json(
        { error: "大儒暂未回应，请稍后再试。" },
        { status: 502 },
      );
    }

    const result = cleanGeneratedText(
      data?.choices?.[0]?.message?.content?.trim() || "",
    );

    if (!result) {
      return NextResponse.json(
        { error: "此言尚未成礼，请再试一次。" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result,
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      demo: false,
      usage: data.usage,
      remaining: rate.remaining,
    });
  } catch (error) {
    console.error("Translate request failed:", error);
    return NextResponse.json(
      { error: "礼官远行未归，请稍后再试。" },
      { status: 502 },
    );
  }
}
