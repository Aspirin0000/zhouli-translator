"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ZhouliLevel, ZhouliMode } from "@/lib/prompt";

const modes: Array<{
  id: ZhouliMode;
  title: string;
  description: string;
  mark: string;
}> = [
  {
    id: "gentle",
    title: "温言相劝",
    description: "顾全情分，徐徐说理",
    mark: "和",
  },
  {
    id: "debate",
    title: "大儒辩经",
    description: "旁征博引，据理力争",
    mark: "辩",
  },
  {
    id: "defend",
    title: "强行圆场",
    description: "另辟名分，判为君子",
    mark: "圆",
  },
  {
    id: "lament",
    title: "痛心疾首",
    description: "小事不察，礼将不存",
    mark: "谏",
  },
];

const levels: Array<{
  id: ZhouliLevel;
  title: string;
  description: string;
}> = [
  { id: "light", title: "小礼", description: "一句高赞短评" },
  { id: "standard", title: "成礼", description: "完整起承转合" },
  { id: "grand", title: "大礼", description: "层层设喻论证" },
];

const examples = [
  "华强买瓜，如何问这瓜保熟吗才合乎周礼",
  "疯狂星期四，谁愿请我一食才合乎周礼",
  "老板说年轻人要多吃苦，我该怎样温言相劝",
  "NiKo十年终夺冠，这事怎么夸才合乎周礼",
];

const loadingLines = [
  "正在正衣冠，辨名分",
  "正在查阅古代贤者旧事",
  "正在把道理说得似乎很有道理",
  "正在请鲁国大儒作最后裁定",
];

function Icon({
  name,
}: {
  name: "arrow" | "copy" | "download" | "refresh" | "check";
}) {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
        <path d="M5 20h14" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M19 12a7 7 0 1 0-2 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function createClientId() {
  const cryptoObject = globalThis.crypto;

  if (typeof cryptoObject?.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }

  if (typeof cryptoObject?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  return [
    "zhouli",
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join("-");
}

function getClientId() {
  const storageKey = "zhouli-client-id";

  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
  } catch {
    // Some embedded browsers or privacy modes block localStorage access.
  }

  const created = createClientId();

  try {
    window.localStorage.setItem(storageKey, created);
  } catch {
    // The ID is only used for soft rate limiting; a per-request fallback is OK.
  }

  return created;
}

async function writeClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Some embedded browsers expose the API but deny clipboard permission.
  }

  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.left = "-9999px";
  helper.style.top = "0";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  helper.setSelectionRange(0, helper.value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  helper.remove();
  return copied;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /load failed|failed to fetch|network|fetch/i.test(message);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchTranslateWithRetry(
  payload: {
    text: string;
    mode: ZhouliMode;
    level: ZhouliLevel;
  },
  clientId: string,
) {
  const retryDelays = [700, 1600];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await fetchWithTimeout(
        "/api/translate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-id": clientId,
          },
          body: JSON.stringify(payload),
        },
        60_000,
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || attempt >= retryDelays.length) {
        break;
      }
      await wait(retryDelays[attempt]);
    }
  }

  throw lastError;
}

export default function Home() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ZhouliMode>("gentle");
  const [level, setLevel] = useState<ZhouliLevel>("standard");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [skillCopied, setSkillCopied] = useState(false);
  const [skillFullCopied, setSkillFullCopied] = useState(false);
  const [skillFullText, setSkillFullText] = useState("");
  const [skillCopyError, setSkillCopyError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const cardImageRef = useRef<HTMLImageElement | null>(null);

  const selectedMode = useMemo(
    () => modes.find((item) => item.id === mode) ?? modes[0],
    [mode],
  );

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingLines.length);
    }, 1300);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;

    fetch("/downloads/speak-zhouli-SKILL.md")
      .then((response) => {
        if (!response.ok) throw new Error("Skill 原文暂未备好。");
        return response.text();
      })
      .then((value) => {
        if (!cancelled) setSkillFullText(value);
      })
      .catch(() => {
        if (!cancelled) setSkillFullText("");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      cardImageRef.current = image;
    };
    image.onerror = () => {
      cardImageRef.current = null;
    };
    image.src = "/images/zhouli-assembly.webp";

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  function updateRateInfo(data: {
    remaining?: unknown;
    dailyRemaining?: unknown;
    retryAfterSeconds?: unknown;
  }) {
    setRemaining(typeof data.remaining === "number" ? data.remaining : null);
    setDailyRemaining(
      typeof data.dailyRemaining === "number" ? data.dailyRemaining : null,
    );
    setRetryAfterSeconds(
      typeof data.retryAfterSeconds === "number" && data.retryAfterSeconds > 0
        ? data.retryAfterSeconds
        : null,
    );
  }

  async function readJsonResponse(response: Response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function getResponseErrorMessage(
    response: Response,
    data: { error?: unknown },
  ) {
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (response.status === 429) {
      return "问礼太急，礼门暂闭，请稍后再来。";
    }

    if (response.status === 403) {
      return "礼门暂设盘查，请稍后再试。";
    }

    return "礼官暂未回应，请稍后再试。";
  }

  async function translate() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setLoadingIndex(0);
    setError("");
    setCopied(false);

    try {
      const response = await fetchTranslateWithRetry(
        { text: text.trim(), mode, level },
        getClientId(),
      );

      const data = await readJsonResponse(response);
      updateRateInfo(data);
      if (!response.ok) {
        throw new Error(getResponseErrorMessage(response, data));
      }

      setResult(data.result);
      setIsDemo(Boolean(data.demo));
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    } catch (requestError) {
      setError(
        isRetryableFetchError(requestError)
          ? "网络一时失礼，已替你重试仍未成，请稍后再点一次。"
          : requestError instanceof Error
            ? requestError.message
            : "礼官暂未回应，请稍后再试。",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    if (await writeClipboard(result)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  async function copySkillPrompt() {
    if (
      await writeClipboard(
        "使用 $speak-zhouli，把“疯狂星期四，谁愿请我一食才合乎周礼”改写成强行圆场的小礼。",
      )
    ) {
      setSkillCopied(true);
      window.setTimeout(() => setSkillCopied(false), 1800);
    }
  }

  async function copyFullSkill() {
    setSkillCopyError("");

    try {
      if (!skillFullText.trim()) {
        throw new Error("Skill 原文还在请出礼库，请稍候再点一次。");
      }

      const chatReadyText = [
        "请把下面这份 Markdown 当作一个 AI Skill 使用。之后我发给你的中文，都按这份 Skill 改写成合乎周礼的话；除非我要求解释，否则只输出改写结果。",
        "",
        skillFullText.trim(),
      ].join("\n");

      if (!(await writeClipboard(chatReadyText))) {
        throw new Error("浏览器暂未允许自动复制。");
      }

      setSkillFullCopied(true);
      window.setTimeout(() => setSkillFullCopied(false), 2200);
    } catch (copyError) {
      setSkillCopyError(
        copyError instanceof Error
          ? copyError.message
          : "未能复制 Skill，请稍后再试。",
      );
    }
  }

  function downloadCard() {
    if (!result) return;

    const canvas = document.createElement("canvas");
    const width = 1200;
    const margin = 76;
    const textX = 154;
    const textRight = width - 154;
    const bodyTop = 326;
    const bodyFont = '39px "Songti SC", "STSong", "SimSun", serif';
    const firstCharacterFont = '700 70px "Songti SC", "STSong", serif';
    const lineHeight = 66;
    const contentWidth = textRight - textX;
    const lineSafetyInset = 38;
    const regularLineMaxWidth = contentWidth - lineSafetyInset;
    const dropCapReservedWidth = 96;
    const probe = canvas.getContext("2d");
    if (!probe) return;
    probe.font = bodyFont;

    const lines: string[] = [];
    let firstBodyLinePending = true;
    for (const paragraph of result.split("\n")) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const char of paragraph) {
        const candidate = line + char;
        const maxLineWidth = firstBodyLinePending
          ? regularLineMaxWidth - dropCapReservedWidth
          : regularLineMaxWidth;
        if (probe.measureText(candidate).width > maxLineWidth) {
          if (line) {
            lines.push(line);
          }
          firstBodyLinePending = false;
          line = char;
        } else {
          line = candidate;
        }
      }
      if (line) {
        lines.push(line);
        firstBodyLinePending = false;
      }
      lines.push("");
    }

    if (lines.at(-1) === "") lines.pop();
    const height = Math.max(1280, bodyTop + 84 + lines.length * lineHeight + 240);
    canvas.width = width;
    canvas.height = height;
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) return;
    const ctx: CanvasRenderingContext2D = canvasContext;

    const levelTitle = levels.find((item) => item.id === level)?.title ?? "成礼";

    function drawPaperGrain() {
      ctx.save();
      for (let index = 0; index < 620; index += 1) {
        const x = (index * 89) % width;
        const y = (index * 157) % height;
        const length = 8 + ((index * 13) % 38);
        ctx.globalAlpha = 0.035 + ((index % 7) * 0.006);
        ctx.strokeStyle = index % 4 === 0 ? "#7f6a4f" : "#b59b77";
        ctx.lineWidth = index % 5 === 0 ? 1.4 : 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(Math.min(width, x + length), y + ((index % 3) - 1) * 0.7);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawCorner(x: number, y: number, scaleX: number, scaleY: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scaleX, scaleY);
      ctx.strokeStyle = "rgba(137, 52, 42, 0.58)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 70);
      ctx.lineTo(0, 0);
      ctx.lineTo(70, 0);
      ctx.stroke();
      ctx.strokeStyle = "rgba(111, 88, 59, 0.36)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, 70);
      ctx.lineTo(18, 18);
      ctx.lineTo(70, 18);
      ctx.stroke();
      ctx.restore();
    }

    function drawSeal(x: number, y: number, size: number, text: string) {
      ctx.save();
      ctx.fillStyle = "#9e3228";
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = "rgba(253, 226, 190, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 8, y + 8, size - 16, size - 16);
      ctx.strokeStyle = "rgba(253, 226, 190, 0.34)";
      ctx.strokeRect(x + 16, y + 16, size - 32, size - 32);
      ctx.fillStyle = "#f7dfba";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (text.length === 1) {
        ctx.font = `700 ${Math.floor(size * 0.54)}px "Songti SC", serif`;
        ctx.fillText(text, x + size / 2, y + size / 2 + 2);
      } else {
        ctx.font = `700 ${Math.floor(size * 0.34)}px "Songti SC", serif`;
        Array.from(text).forEach((char, index) => {
          ctx.fillText(char, x + size / 2, y + size * (0.34 + index * 0.28));
        });
      }
      ctx.restore();
    }

    function drawVerticalText(
      text: string,
      x: number,
      y: number,
      gap: number,
      font: string,
      color: string,
    ) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      Array.from(text).forEach((char, index) => {
        ctx.fillText(char, x, y + index * gap);
      });
      ctx.restore();
    }

    const assemblyImage = cardImageRef.current;

    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#f7eedf");
    background.addColorStop(0.48, "#efe0c7");
    background.addColorStop(1, "#dbc7a8");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    if (assemblyImage) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.filter = "grayscale(0.35) sepia(0.38)";
      const imageWidth = width * 1.2;
      const imageHeight = (imageWidth * assemblyImage.height) / assemblyImage.width;
      ctx.drawImage(assemblyImage, -78, 74, imageWidth, imageHeight);
      ctx.restore();

      const wash = ctx.createLinearGradient(0, 0, 0, height);
      wash.addColorStop(0, "rgba(247, 238, 223, 0.38)");
      wash.addColorStop(0.36, "rgba(245, 235, 217, 0.74)");
      wash.addColorStop(1, "rgba(223, 202, 170, 0.5)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
    }

    drawPaperGrain();

    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = "#8c342a";
    ctx.font = '700 520px "Songti SC", "STSong", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("礼", width / 2, height / 2 + 12);
    ctx.restore();

    ctx.strokeStyle = "rgba(102, 78, 48, 0.34)";
    ctx.lineWidth = 2;
    ctx.strokeRect(38, 38, width - 76, height - 76);
    ctx.strokeStyle = "rgba(255, 249, 235, 0.52)";
    ctx.strokeRect(52, 52, width - 104, height - 104);
    ctx.strokeStyle = "rgba(102, 78, 48, 0.2)";
    ctx.strokeRect(66, 66, width - 132, height - 132);

    drawCorner(58, 58, 1, 1);
    drawCorner(width - 58, 58, -1, 1);
    drawCorner(58, height - 58, 1, -1);
    drawCorner(width - 58, height - 58, -1, -1);

    const panelHeight = height - bodyTop - 216;
    ctx.fillStyle = "rgba(255, 249, 238, 0.7)";
    ctx.fillRect(104, bodyTop - 28, width - 208, panelHeight);
    ctx.strokeStyle = "rgba(103, 78, 48, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(104, bodyTop - 28, width - 208, panelHeight);
    ctx.strokeStyle = "rgba(158, 50, 40, 0.18)";
    ctx.beginPath();
    ctx.moveTo(textX - 34, bodyTop + 36);
    ctx.lineTo(textX - 34, bodyTop + panelHeight - 78);
    ctx.stroke();

    drawSeal(106, 92, 104, "礼");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#211d18";
    ctx.font = '700 72px "Songti SC", "STSong", serif';
    ctx.fillText("合乎周礼", 238, 137);
    ctx.fillStyle = "#7c6d59";
    ctx.font = '26px "Songti SC", "STSong", serif';
    ctx.fillText("把寻常的话，说得有礼有据", 242, 183);
    ctx.fillStyle = "rgba(136, 48, 39, 0.86)";
    ctx.font = '600 15px "PingFang SC", sans-serif';
    ctx.letterSpacing = "0.12em";
    ctx.fillText("ZHOU LI · RITE NOTE", 244, 218);
    ctx.letterSpacing = "0";

    drawVerticalText(
      "言之成礼",
      width - 124,
      92,
      34,
      '600 24px "Songti SC", serif',
      "rgba(136, 48, 39, 0.86)",
    );
    ctx.strokeStyle = "rgba(158, 50, 40, 0.78)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(106, 258);
    ctx.lineTo(width - 106, 258);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 248, 232, 0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(106, 264);
    ctx.lineTo(width - 106, 264);
    ctx.stroke();

    ctx.fillStyle = "#2b241d";
    ctx.font = bodyFont;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    let y = bodyTop + 82;
    let firstVisibleLine = true;
    for (const line of lines) {
      if (line) {
        if (firstVisibleLine) {
          const [firstCharacter = "", ...restCharacters] = Array.from(line);

          ctx.save();
          ctx.fillStyle = "#9e3228";
          ctx.font = '46px "Songti SC", serif';
          ctx.fillText("「", textX - 48, y - 5);
          ctx.font = firstCharacterFont;
          ctx.fillText(firstCharacter, textX, y + 3);
          const firstCharacterWidth = ctx.measureText(firstCharacter).width;
          ctx.fillStyle = "#2b241d";
          ctx.font = bodyFont;
          const restX = textX + firstCharacterWidth + 12;
          ctx.fillText(
            restCharacters.join(""),
            restX,
            y,
            Math.max(120, textRight - restX - lineSafetyInset),
          );
          ctx.restore();
          firstVisibleLine = false;
        } else {
          ctx.fillText(line, textX, y, regularLineMaxWidth);
        }
        y += lineHeight;
      } else {
        y += lineHeight * 0.58;
      }
    }

    ctx.save();
    ctx.strokeStyle = "rgba(103, 78, 48, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(106, height - 176);
    ctx.lineTo(width - 106, height - 176);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#9e3228";
    ctx.font = '600 25px "Songti SC", serif';
    ctx.textAlign = "left";
    ctx.fillText(`礼制 · ${selectedMode.title} · ${levelTitle}`, 112, height - 118);
    ctx.fillStyle = "#7a6d5b";
    ctx.font = '22px "Songti SC", serif';
    ctx.fillText("一言既出，众贤共阅", 112, height - 80);

    const footerSealSize = 66;
    const footerSealX = width - 176;
    drawSeal(footerSealX, height - 151, footerSealSize, "善");
    ctx.textAlign = "right";
    ctx.fillStyle = "#7a6d5b";
    ctx.font = '22px "Songti SC", serif';
    ctx.fillText("合乎周礼 · 礼官署录", footerSealX - 28, height - 101);
    ctx.font = '15px "PingFang SC", sans-serif';
    ctx.fillText("生成之文，可入席陈说", footerSealX - 28, height - 74);

    const link = document.createElement("a");
    link.download = "合乎周礼.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main>
      <div className="page-noise" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="合乎周礼首页">
          <span className="brand-seal">礼</span>
          <span>
            <strong>合乎周礼</strong>
            <small>ZHOU LI</small>
          </span>
        </a>
        <nav aria-label="页面导航">
          <a href="#translator">制礼</a>
          <a href="#skill">纳礼</a>
          <a href="#principles">礼法</a>
          <a href="#about">缘起</a>
        </nav>
        <span className="header-note">大周礼时代 · 试行本</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span />
          兼研百段热评与古代典籍译文
          <span />
        </div>
        <h1>
          把寻常的话
          <br />
          <em>说得有礼有据</em>
        </h1>
        <p className="hero-copy">
          现代白话为骨，典籍译文为法。
          <br />
          输入一句话，请大儒替你讲得有礼有据。
        </p>
        <a className="hero-cta" href="#translator">
          入席问礼
          <Icon name="arrow" />
        </a>
        <div className="hero-orbit orbit-one" aria-hidden="true">
          <span>礼</span>
        </div>
        <div className="hero-orbit orbit-two" aria-hidden="true">
          <span>乐</span>
        </div>
        <div className="hero-side-note left">克己复礼</div>
        <div className="hero-side-note right">文质彬彬</div>
      </section>

      <figure className="assembly-section" aria-labelledby="assembly-title">
        <div className="assembly-frame">
          <Image
            className="assembly-image"
            src="/images/zhouli-assembly.webp"
            alt="水墨画中，众人围坐听一位长者从容陈说"
            width={2396}
            height={1500}
            sizes="(max-width: 680px) 100vw, (max-width: 1500px) 94vw, 1400px"
            loading="eager"
          />
          <div className="assembly-wash" aria-hidden="true" />
          <figcaption className="assembly-inscription">
            <span className="assembly-seal" aria-hidden="true">
              善
            </span>
            <div>
              <p>诸贤列席 · 一言待陈</p>
              <h2 id="assembly-title">有话，请当众说个明白</h2>
              <span>
                今日不论大事小事，只要心中有话，
                <br />
                都可向前一步，请众人一同评理。
              </span>
            </div>
          </figcaption>
          <span className="assembly-corner corner-top" aria-hidden="true" />
          <span className="assembly-corner corner-bottom" aria-hidden="true" />
        </div>
        <div className="assembly-footnote" aria-hidden="true">
          <span>观其言</span>
          <i />
          <span>正其名</span>
          <i />
          <span>然后成礼</span>
        </div>
      </figure>

      <section className="translator-section" id="translator">
        <div className="section-heading">
          <span className="section-number">
            <i>壹</i>
          </span>
          <div>
            <p>一言入席，百礼相生</p>
            <h2>请说人话，再成周礼</h2>
          </div>
        </div>

        <div className="translator-shell">
          <div className="translator-panel input-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-label">原言</span>
                <h3>你本来想说什么？</h3>
              </div>
              <span className={`character-count ${text.length > 280 ? "warning" : ""}`}>
                {text.length} / 300
              </span>
            </div>

            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value.slice(0, 300));
                setError("");
              }}
              placeholder="例如：疯狂星期四，谁愿请我一食才合乎周礼……"
              aria-label="输入需要翻译的原话"
              maxLength={300}
            />

            <div className="example-row">
              <span>不知说什么？</span>
              <div>
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setText(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider">
              <span>择其辞气</span>
            </div>

            <div className="mode-grid" role="radiogroup" aria-label="选择说话方式">
              {modes.map((item) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === item.id}
                  className={mode === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setMode(item.id)}
                >
                  <span className="mode-mark">{item.mark}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="level-field">
              <div>
                <span className="field-title">礼制深浅</span>
                <span className="field-help">由短评到长篇辩经</span>
              </div>
              <div className="level-switch" role="radiogroup" aria-label="选择生成长度">
                {levels.map((item) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={level === item.id}
                    className={level === item.id ? "active" : ""}
                    key={item.id}
                    onClick={() => setLevel(item.id)}
                    title={item.description}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="error-message">{error}</p>}

            <button
              className="translate-button"
              type="button"
              disabled={!text.trim() || loading}
              onClick={translate}
            >
              <span className="button-decoration">◆</span>
              <span>
                {loading ? loadingLines[loadingIndex] : "请周公制礼"}
              </span>
              {loading ? (
                <span className="loading-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <Icon name="arrow" />
              )}
            </button>
          </div>

          <div
            className={`translator-panel result-panel ${result ? "has-result" : ""}`}
            ref={resultRef}
          >
            <div className="result-topline">
              <div>
                <span className="panel-label inverse">成礼</span>
                <span className="result-style">
                  {selectedMode.title} ·{" "}
                  {levels.find((item) => item.id === level)?.title}
                </span>
              </div>
              <span className="result-seal" aria-hidden="true">
                合礼
              </span>
            </div>

            {result ? (
              <>
                <div className="result-content">
                  {result.split("\n").map((paragraph, index) =>
                    paragraph ? <p key={index}>{paragraph}</p> : <br key={index} />,
                  )}
                </div>
                <div className="result-actions">
                  <button type="button" onClick={copyResult}>
                    <Icon name={copied ? "check" : "copy"} />
                    {copied ? "已录于简册" : "复制全文"}
                  </button>
                  <button type="button" onClick={downloadCard}>
                    <Icon name="download" />
                    生成礼帖
                  </button>
                  <button type="button" onClick={translate}>
                    <Icon name="refresh" />
                    再议一次
                  </button>
                </div>
                <div className="result-meta">
                  <span>{isDemo ? "本地演示 · 配置 API 后启用大模型" : "DeepSeek 大儒已阅"}</span>
                  {remaining !== null && (
                    <span>
                      本轮尚可问礼 {remaining} 次
                      {dailyRemaining !== null ? ` · 今日余 ${dailyRemaining} 次` : ""}
                      {retryAfterSeconds !== null
                        ? ` · 约 ${Math.ceil(retryAfterSeconds / 60)} 分钟后再问`
                        : ""}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-result">
                <span className="empty-glyph">礼</span>
                <p>言未至，礼未成</p>
                <small>
                  在左侧写下一句话
                  <br />
                  选择辞气，再请周公制礼
                </small>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="skill-section" id="skill">
        <div className="skill-heading">
          <div>
            <span className="eyebrow">请礼归家 · 免费下载</span>
            <h2>把这套礼法，<br />请进你自己的 AI</h2>
          </div>
          <p>
            不必每次打开网页，也不消耗本站的 API。
            一键复制 Skill 后，直接粘贴到任意 AI 聊天框里就能用；
            也可以下载后安装，让自己的 AI
            温言相劝、大儒辩经、强行圆场或痛心疾首。
          </p>
        </div>

        <div className="skill-layout">
          <article className="skill-package-card">
            <div className="skill-package-top">
              <span className="skill-knot" aria-hidden="true">礼</span>
              <div>
                <small>AI SKILL · 试行第一版</small>
                <h3>speak-zhouli</h3>
                <p>现代白话为骨，礼法故事为证。</p>
              </div>
            </div>

            <div className="skill-capabilities" aria-label="Skill 能力">
              <span>温言相劝</span>
              <span>大儒辩经</span>
              <span>强行圆场</span>
              <span>痛心疾首</span>
            </div>

            <div className="skill-file-list">
              <span><i>文</i> SKILL.md</span>
              <span><i>令</i> agents/openai.yaml</span>
            </div>

            <div className="skill-actions">
              <button
                className="skill-copy-full"
                type="button"
                disabled={!skillFullText}
                onClick={copyFullSkill}
              >
                <span>
                  <strong>
                    {skillFullCopied ? "已复制，可粘贴" : "一键复制 Skill 全文"}
                  </strong>
                  <small>
                    {skillFullText
                      ? "粘贴到 AI 聊天框即可使用"
                      : "正在请出 Skill 原文"}
                  </small>
                </span>
                <Icon name={skillFullCopied ? "check" : "copy"} />
              </button>

              <a
                className="skill-download"
                href="/downloads/speak-zhouli-skill.zip"
                download
              >
                <span>
                  <strong>下载合乎周礼 Skill</strong>
                  <small>ZIP · 解压即可安装</small>
                </span>
                <Icon name="download" />
              </a>
            </div>

            <p className="skill-cost-note">
              复制与下载均免费 · 不含模型或 API · 使用你自己的 AI 算力
            </p>
            {skillCopyError && (
              <p className="skill-copy-error">{skillCopyError}</p>
            )}
          </article>

          <div className="install-guide">
            <div className="install-title">
              <span><i>用法</i></span>
              <div>
                <small>复制即用</small>
                <h3>拿到 Skill 以后怎么用？</h3>
              </div>
            </div>

            <ol className="install-steps">
              <li>
                <span>一</span>
                <div>
                  <h4>最快用法：复制全文</h4>
                  <p>
                    点击左侧“一键复制 Skill 全文”，直接粘贴进 AI
                    的聊天框。AI 读完后，你再发要改写的话即可。
                  </p>
                </div>
              </li>
              <li>
                <span>二</span>
                <div>
                  <h4>正式安装：下载并解压</h4>
                  <p>也可以下载 ZIP，解压后保留完整的 <code>speak-zhouli</code> 文件夹。</p>
                </div>
              </li>
              <li>
                <span>三</span>
                <div>
                  <h4>放入 Skill 目录</h4>
                  <p>Codex（macOS / Linux）</p>
                  <code>~/.codex/skills/speak-zhouli</code>
                  <p>Codex（Windows）</p>
                  <code>%USERPROFILE%\.codex\skills\speak-zhouli</code>
                </div>
              </li>
              <li>
                <span>四</span>
                <div>
                  <h4>在对话中点名使用</h4>
                  <div className="prompt-example">
                    <p>
                      使用 $speak-zhouli，把“疯狂星期四，谁愿请我一食才合乎周礼”
                      改写成强行圆场的小礼。
                    </p>
                    <button type="button" onClick={copySkillPrompt}>
                      <Icon name={skillCopied ? "check" : "copy"} />
                      {skillCopied ? "已抄录" : "复制"}
                    </button>
                  </div>
                </div>
              </li>
            </ol>

          </div>
        </div>
      </section>

      <section className="principles-section" id="principles">
        <div className="section-heading light">
          <span className="section-number">
            <i>叁</i>
          </span>
          <div>
            <p>并非满纸之乎者也</p>
            <h2>何谓真正合乎周礼？</h2>
          </div>
        </div>
        <div className="principle-grid">
          <article>
            <span className="principle-index">01</span>
            <div className="principle-symbol">白</div>
            <h3>白话为骨</h3>
            <p>用现代人听得懂的句子，把一个简单意思郑重地解释很多遍。</p>
          </article>
          <article>
            <span className="principle-index">02</span>
            <div className="principle-symbol">典</div>
            <h3>故事为证</h3>
            <p>搬出一位古人、一种草木或一段旧事，为眼前小事建立依据。</p>
          </article>
          <article>
            <span className="principle-index">03</span>
            <div className="principle-symbol">转</div>
            <h3>曲折成理</h3>
            <p>先承认，再转折，最后得出一本正经而略显牵强的结论。</p>
          </article>
          <article>
            <span className="principle-index">04</span>
            <div className="principle-symbol">问</div>
            <h3>反问定谳</h3>
            <p>不急着责骂，只用一句温和反问，让对方自己领会礼法深意。</p>
          </article>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="about-seal" aria-hidden="true">
          <span>百</span>
          <span>评</span>
        </div>
        <div>
          <span className="eyebrow">缘起</span>
          <h2>从一百个视频的评论区，也从古代典籍的译文里，重新学会说话。</h2>
        </div>
        <p>
          我们观察了“大周礼时代”近期一百个相关视频中的高赞评论，
          也参考《周礼》《论语》《孟子》《出师表》《桃花源记》等常见篇目的白话译文：
          真正受欢迎的不是晦涩古文，而是那种曾在课文旁边见过的翻译腔。
          这个工具保留那份一本正经的幽默，也尽量让每个名分有来处、每个道理听得懂。
        </p>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-seal">礼</span>
          <span>
            <strong>合乎周礼</strong>
            <small>言之有物，戏而有度</small>
          </span>
        </div>
        <p>本工具用于语言娱乐与文化创作，生成内容请自行判断与核实。</p>
        <div className="footer-right">
          <span>周礼试行本 · 二〇二六</span>
          <a
            href="https://github.com/Aspirin0000"
            target="_blank"
            rel="noreferrer"
            aria-label="Aspirin0000 GitHub"
          >
            github.com/Aspirin0000
          </a>
        </div>
      </footer>
    </main>
  );
}
