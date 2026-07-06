import { NextRequest, NextResponse } from "next/server";
import {
  buildUserPrompt,
  getSystemPrompt,
  type ZhouliLevel,
  type ZhouliMode,
} from "@/lib/prompt";
import {
  type Persona,
  demoResult,
  quotedThreatEvaluationResult,
  cyberAuditResult,
  safetyBlockResult,
  directedAttackFallback,
  firstPersonWorkThanksFallback,
  guardLabel,
  guardLabelStrict,
  demoLabel,
  parsePersona,
} from "@/lib/personaContent";

export const runtime = "nodejs";

const VALID_MODES = new Set<ZhouliMode>([
  "gentle",
  "debate",
  "defend",
  "lament",
]);
const VALID_LEVELS = new Set<ZhouliLevel>(["light", "standard", "grand"]);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_WINDOW_LIMIT = 12;
const RATE_DAY_LIMIT = 60;

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

function getShanghaiDay(now: number) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function secondsUntilNextShanghaiDay(now: number) {
  const shanghaiNow = new Date(now + 8 * 60 * 60 * 1000);
  const nextShanghaiMidnightUtc =
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() + 1,
    ) -
    8 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((nextShanghaiMidnightUtc - now) / 1000));
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const today = getShanghaiDay(now);
  const current = rateLimit.get(key);

  if (!current || current.day !== today) {
    rateLimit.set(key, {
      windowStartedAt: now,
      count: 1,
      day: today,
      dayCount: 1,
    });
    return {
      allowed: true,
      remaining: Math.min(RATE_WINDOW_LIMIT - 1, RATE_DAY_LIMIT - 1),
      windowRemaining: RATE_WINDOW_LIMIT - 1,
      dailyRemaining: RATE_DAY_LIMIT - 1,
      retryAfterSeconds: 0,
    };
  }

  if (now - current.windowStartedAt > RATE_WINDOW_MS) {
    current.windowStartedAt = now;
    current.count = 0;
  }

  const dailyRemainingBefore = Math.max(0, RATE_DAY_LIMIT - current.dayCount);
  const windowRemainingBefore = Math.max(0, RATE_WINDOW_LIMIT - current.count);

  if (current.dayCount >= RATE_DAY_LIMIT) {
    return {
      allowed: false,
      reason: "day" as const,
      remaining: 0,
      windowRemaining: windowRemainingBefore,
      dailyRemaining: 0,
      retryAfterSeconds: secondsUntilNextShanghaiDay(now),
    };
  }

  if (current.count >= RATE_WINDOW_LIMIT) {
    return {
      allowed: false,
      reason: "window" as const,
      remaining: 0,
      windowRemaining: 0,
      dailyRemaining: dailyRemainingBefore,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.windowStartedAt + RATE_WINDOW_MS - now) / 1000),
      ),
    };
  }

  current.count += 1;
  current.dayCount += 1;
  rateLimit.set(key, current);
  const dailyRemaining = Math.max(0, RATE_DAY_LIMIT - current.dayCount);
  const windowRemaining = Math.max(0, RATE_WINDOW_LIMIT - current.count);
  return {
    allowed: true,
    remaining: Math.min(dailyRemaining, windowRemaining),
    windowRemaining,
    dailyRemaining,
    retryAfterSeconds: 0,
  };
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

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function isSafetySeekingText(text: string) {
  return /(举报|报警|求助|防范|预防|避免|识别|反诈|阻止|劝|安慰|救|保护|维权|投诉|合法|正当|授权|受托|取证|求救)/.test(
    text,
  );
}

function isCyberAuditRequest(text: string) {
  const mentionsAudit =
    /(渗透测试|渗透|安全测试|安全巡检|漏洞扫描|漏洞检测|查漏洞|查门闩|攻防演练|红队测试)/i.test(
      text,
    );
  const mentionsTarget =
    /(网站|网页|站点|本站|该站|该网站|这个网站|我的网站|系统|应用|平台|服务器)/.test(
      text,
    );
  const clearlyMalicious =
    /(盗号|撞库|钓鱼|木马|勒索|绕过登录|破解密码|黑进|入侵|DDoS|ddos|脱库|后门|提权|窃取|偷取|拿数据|偷数据|获取管理员|getshell|webshell|shell|拖库)/i.test(
      text,
    );

  return mentionsAudit && mentionsTarget && !clearlyMalicious;
}

function isQuotedThreatEvaluationInput(text: string) {
  const isQuotedOrEvaluative =
    /(他说|她说|别人说|有人说|对方说|朋友说|老板说|同事说|这句话|这话|怎么评价|如何评价|怎么看|怎么理解)/.test(
      text,
    );
  const hasThreatSignal =
    /(c死|操死|干死|弄死|打死|杀了|杀死|砍死|捅死|打残|打爆|暴打|去死|取你性命|要你命|报复)/.test(
      text,
    );

  return isQuotedOrEvaluative && hasThreatSignal;
}

function getSafetyBlockKind(text: string) {
  if (isSafetySeekingText(text)) {
    return "";
  }

  if (
    /(自杀|轻生|割腕|跳楼|结束生命|不想活|怎么死|无痛死|安眠药.{0,8}死)/.test(
      text,
    )
  ) {
    return "self_harm";
  }

  if (
    /(未成年.{0,12}(色情|裸照|性|约)|儿童色情|萝莉.{0,8}(色情|裸照|资源)|幼女|幼童.{0,8}(性|裸照))/i.test(
      text,
    )
  ) {
    return "minor_sexual";
  }

  if (
    /(盗号|撞库|钓鱼网站|木马|勒索软件|绕过登录|破解密码|黑进|入侵|DDoS|ddos|脱库|后门|提权|窃取.{0,8}(账号|密码|数据|cookie|Cookie)|拿数据|偷数据|获取管理员|getshell|webshell|拖库)/i.test(
      text,
    )
  ) {
    return "cyber";
  }

  if (
    /(诈骗|骗钱|骗老人|杀猪盘|洗钱|伪造.{0,8}(证件|发票|病假|公章)|逃避警察|销毁证据|贩毒|制毒|毒品|走私|偷.{0,8}(车|钱|东西)|抢劫)/.test(
      text,
    )
  ) {
    return "illegal";
  }

  if (
    /(爆炸|炸药|爆炸物|投毒|放火|纵火|绑架|杀了|杀死|弄死|打残|砍死|捅死|报复.{0,10}(老板|同学|前任|室友|邻居)|下药|迷奸|强奸)/.test(
      text,
    )
  ) {
    return "violence";
  }

  if (
    /(人肉|开盒|盒武器|身份证号|家庭住址|定位.{0,10}(前任|前女友|前男友|同事|别人|网友)|跟踪.{0,8}(前任|别人|同事|网友)|偷拍|窃听)/.test(
      text,
    )
  ) {
    return "privacy";
  }

  if (
    /(仇恨言论|种族歧视|辱骂.{0,12}(黑人|女人|女性|同性恋|残疾人|外地人|某民族)|煽动.{0,12}(仇恨|歧视|暴力))/.test(
      text,
    )
  ) {
    return "hate";
  }

  return "";
}

function isDirectedSecondPersonAttackInput(text: string) {
  const isQuotedOrEvaluative =
    /(他说|她说|别人说|有人说|对方说|朋友说|老板说|同事说|这句话|这话|怎么评价|如何评价|怎么看|怎么理解)/.test(
      text,
    );
  const hasFirstToSecondPerson =
    /(^\s*我|我想|我要|我会|我准备|我打算).{0,18}(你|你的|你们|您|贵方)/.test(
      text,
    );
  const hasAttackSignal =
    /(c死|操死|干死|弄死|打死|杀了|杀死|砍死|捅死|揍你|揍死|暴打|打爆|打残|去死|骂你|喷你|怼你|草你|艹你|操你|干你|傻逼|滚|你全家|你的全家|你的母|问候你妈|问候你母)/.test(
      text,
    );
  return !isQuotedOrEvaluative && hasFirstToSecondPerson && hasAttackSignal;
}

function hasDirectedAttackPerspectiveError(result: string) {
  return /你出言粗鄙|阁下说出|阁下开口|阁下这番话|你骂了我|你伤了我|对方骂我|被无礼之言所伤|你以禽兽之名相辱|以禽兽之名相辱|你把.{0,16}话|你却将|你却把|对人父母出言不逊|先问自己|我可曾|开口的人自己失礼|失礼的是我|我乱了本心|我该退后一步|我该重新想想|我分寸守不住|三省吾身/.test(
    result,
  );
}

function normalizeDirectedAttackResult(
  text: string,
  result: string,
  level: ZhouliLevel,
  persona: Persona,
) {
  if (
    isDirectedSecondPersonAttackInput(text) &&
    hasDirectedAttackPerspectiveError(result)
  ) {
    return directedAttackFallback(persona, text, level);
  }

  return result;
}

function isFirstPersonWorkThanksInput(text: string) {
  const mentionsMyWork =
    /(我做|我建|我造|我发|我的).{0,30}(网站|网页|视频|作品|工具|项目|应用|skill|Skill)|观众感谢我|别人夸我|粉丝夸我|用户感谢我/.test(
      text,
    );
  const asksForReply = /(感谢我|夸我|如何回复|怎么回复|怎么说|如何说)/.test(
    text,
  );
  return mentionsMyWork && asksForReply;
}

function hasFirstPersonWorkPerspectiveError(result: string) {
  return /你做网站|你做了|您做了|你建了|您建了|你造了|您造了|你发了|您发了|你若|你安了心|他们来谢|大家感谢你|观众感谢你|粉丝感谢你/.test(
    result,
  );
}

function normalizeFirstPersonWorkResult(
  text: string,
  result: string,
  level: ZhouliLevel,
  persona: Persona,
) {
  if (
    isFirstPersonWorkThanksInput(text) &&
    hasFirstPersonWorkPerspectiveError(result)
  ) {
    return firstPersonWorkThanksFallback(persona, level);
  }

  return result;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchDeepSeekWithRetry(
  apiKey: string,
  body: Record<string, unknown>,
) {
  const retryDelays = [800];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });

      if (response.ok || response.status < 500 || attempt >= retryDelays.length) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= retryDelays.length) {
        throw error;
      }
    }

    await wait(retryDelays[attempt]);
  }

  throw lastError;
}

export async function POST(request: NextRequest) {
  const key = getClientKey(request);
  const rate = checkRateLimit(key);

  if (!rate.allowed) {
    const isWindowLimit = rate.reason === "window";
    return NextResponse.json(
      {
        error: isWindowLimit
          ? `问礼太急，请约 ${Math.ceil(rate.retryAfterSeconds / 60)} 分钟后再来。`
          : "今日问礼已满，请明日再来。",
        remaining: rate.remaining,
        windowRemaining: rate.windowRemaining,
        dailyRemaining: rate.dailyRemaining,
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: {
    text?: unknown;
    mode?: unknown;
    level?: unknown;
    persona?: unknown;
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
  const persona = parsePersona(body.persona);

  if (!text) {
    return NextResponse.json({ error: "无言不可成礼，请先写下一句话。" }, { status: 400 });
  }

  if (text.length > 300) {
    return NextResponse.json(
      { error: "言多则礼繁，请将原话控制在300字以内。" },
      { status: 400 },
    );
  }

  if (isCyberAuditRequest(text)) {
    return NextResponse.json({
      result: cyberAuditResult(persona, level),
      model: guardLabel(persona),
      demo: false,
      guarded: true,
      cyberAudit: true,
      remaining: rate.remaining,
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  if (isQuotedThreatEvaluationInput(text)) {
    return NextResponse.json({
      result: quotedThreatEvaluationResult(persona, level),
      model: guardLabel(persona),
      demo: false,
      guarded: true,
      quoteEvaluation: true,
      remaining: rate.remaining,
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  const safetyBlockKind = getSafetyBlockKind(text);
  if (safetyBlockKind) {
    return NextResponse.json({
      result: safetyBlockResult(persona, safetyBlockKind),
      model: guardLabelStrict(persona),
      demo: false,
      guarded: true,
      safetyBlocked: true,
      remaining: rate.remaining,
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  if (isDirectedSecondPersonAttackInput(text)) {
    return NextResponse.json({
      result: directedAttackFallback(persona, text, level),
      model: guardLabel(persona),
      demo: false,
      guarded: true,
      remaining: rate.remaining,
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      result: demoResult(persona, text, mode, level),
      model: demoLabel(persona),
      demo: true,
      remaining: rate.remaining,
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const response = await fetchDeepSeekWithRetry(apiKey, {
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: getSystemPrompt(persona) },
        { role: "user", content: buildUserPrompt(text, mode, level, persona) },
      ],
      max_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 720),
      temperature: 0.9,
      stream: false,
      thinking: { type: "disabled" },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DeepSeek API error:", data);
      return NextResponse.json(
        { error: "大儒暂未回应，请稍后再试。" },
        { status: 502 },
      );
    }

    const cleanedResult = cleanGeneratedText(
      data?.choices?.[0]?.message?.content?.trim() || "",
    );
    const result = normalizeFirstPersonWorkResult(
      text,
      normalizeDirectedAttackResult(text, cleanedResult, level, persona),
      level,
      persona,
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
      windowRemaining: rate.windowRemaining,
      dailyRemaining: rate.dailyRemaining,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  } catch (error) {
    console.error("Translate request failed:", error);
    return NextResponse.json(
      { error: "礼官远行未归，请稍后再试。" },
      { status: 502 },
    );
  }
}
