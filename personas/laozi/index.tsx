"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCardDownloadFilename } from "@/lib/cardDownload";
import type { ZhouliLevel, ZhouliMode } from "@/lib/prompt";
import type { Persona, PersonaPageProps } from "@/personas/types";

const modes: Array<{
  id: ZhouliMode;
  title: string;
  description: string;
  mark: string;
}> = [
  {
    id: "gentle",
    title: "以退为进柔",
    description: "守柔处下，不争而胜",
    mark: "柔",
  },
  {
    id: "debate",
    title: "反者道之动",
    description: "以反向思维，察大道真意",
    mark: "反",
  },
  {
    id: "defend",
    title: "无为而治",
    description: "顺势而为，不妄作故能成",
    mark: "无",
  },
  {
    id: "lament",
    title: "归根曰静",
    description: "万般纷扰，终归于静",
    mark: "静",
  },
];

const levels: Array<{
  id: ZhouliLevel;
  title: string;
  description: string;
}> = [
  { id: "light", title: "微言", description: "一句淡泊之言" },
  { id: "standard", title: "常道", description: "自然起承转合" },
  { id: "grand", title: "大道", description: "层层譬喻体道" },
];

const examples = [
  "朋友找我借钱不还，如何说才合乎天道",
  "老板画大饼该不该信，如何应对才合乎自然",
  "家人总催我结婚生子，我该如何回应",
  "同事抢我功劳，我该忍让还是争辩",
];

const originalVideoUrl =
  "https://www.bilibili.com/video/BV12a7N6qE1g/";
const githubUrl = "https://github.com/Aspirin0000/zhouli-translator";

const loadingLines = [
  "正在静心凝神，观照本真",
  "正在体察天地自然之道",
  "正在将道理说成自然之理",
  "正在请老子作个转圜",
];

const personas: Array<{
  id: Persona;
  label: string;
  mark: string;
}> = [
  { id: "confucius", label: "孔子", mark: "儒" },
  { id: "zen", label: "禅宗", mark: "释" },
  { id: "laozi", label: "老子", mark: "道" },
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
  }

  const created = createClientId();

  try {
    window.localStorage.setItem(storageKey, created);
  } catch {
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
    persona: Persona;
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

export default function LaoziPage({ persona, onPersonaChange }: PersonaPageProps) {
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
  const [skillFullText, setSkillFullText] = useState<string | null>(null);
  const [skillCopyError, setSkillCopyError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const personaMenuRef = useRef<HTMLDivElement>(null);
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

    fetch("/downloads/speak-dadao-SKILL.md")
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
    setMounted(true);
  }, []);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      cardImageRef.current = image;
    };
    image.onerror = () => {
      cardImageRef.current = null;
    };
    image.src = "/images/laozi-assembly.jpg";

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  useEffect(() => {
    if (!showPersonaMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        personaMenuRef.current &&
        !personaMenuRef.current.contains(e.target as Node)
      ) {
        setShowPersonaMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPersonaMenu]);

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
      return "问道太急，道门暂闭，请稍后再来。";
    }

    if (response.status === 403) {
      return "道门暂设盘查，请稍后再试。";
    }

    return "道官暂未回应，请稍后再试。";
  }

  async function translate() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setLoadingIndex(0);
    setError("");
    setCopied(false);

    try {
      const response = await fetchTranslateWithRetry(
        { text: text.trim(), mode, level, persona },
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
          ? "网络一时失道，已替你重试仍未成，请稍后再点一次。"
          : requestError instanceof Error
            ? requestError.message
            : "道官暂未回应，请稍后再试。",
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
        "使用 $speak-dadao，把'朋友找我借钱不还，如何说才合乎天道'改写成无为而治的微言。",
      )
    ) {
      setSkillCopied(true);
      window.setTimeout(() => setSkillCopied(false), 1800);
    }
  }

  async function copyFullSkill() {
    setSkillCopyError("");

    try {
      if (!skillFullText?.trim()) {
        throw new Error("Skill 原文还在请出道库，请稍候再点一次。");
      }

      const chatReadyText = [
        "请把下面这份 Markdown 当作一个 AI Skill 使用。之后我发给你的中文，都按这份 Skill 改写成合乎大道的话；除非我要求解释，否则只输出改写结果。",
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
    const accent = "#4a6b5d";
    const accentDeep = "#35534a";
    const accentSoft = "rgba(74, 107, 93, 0.58)";
    const accentText = "rgba(74, 107, 93, 0.86)";

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
      ctx.strokeStyle = accentSoft;
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
      ctx.fillStyle = accent;
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
    ctx.fillStyle = accent;
    ctx.font = '700 520px "Songti SC", "STSong", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("道", width / 2, height / 2 + 12);
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
    ctx.strokeStyle = "rgba(74, 107, 93, 0.18)";
    ctx.beginPath();
    ctx.moveTo(textX - 34, bodyTop + 36);
    ctx.lineTo(textX - 34, bodyTop + panelHeight - 78);
    ctx.stroke();

    drawSeal(106, 92, 104, "道");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#211d18";
    ctx.font = '700 72px "Songti SC", "STSong", serif';
    ctx.fillText("合乎大道", 238, 137);
    ctx.fillStyle = "#7c6d59";
    ctx.font = '26px "Songti SC", "STSong", serif';
    ctx.fillText("把寻常的事，说得合道自然", 242, 183);
    ctx.fillStyle = accentText;
    ctx.font = '600 15px "PingFang SC", sans-serif';
    ctx.letterSpacing = "0.12em";
    ctx.fillText("DAO DE · DAO NOTE", 244, 218);
    ctx.letterSpacing = "0";

    drawVerticalText(
      "言之合道",
      width - 124,
      92,
      34,
      '600 24px "Songti SC", serif',
      accentText,
    );
    ctx.strokeStyle = "rgba(74, 107, 93, 0.78)";
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
          ctx.fillStyle = accent;
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

    ctx.fillStyle = accent;
    ctx.font = '600 25px "Songti SC", serif';
    ctx.textAlign = "left";
    ctx.fillText(`道法 · ${selectedMode.title} · ${levelTitle}`, 112, height - 118);
    ctx.fillStyle = "#7a6d5b";
    ctx.font = '22px "Songti SC", serif';
    ctx.fillText("一言既出，万物共鉴", 112, height - 80);

    const footerSealSize = 66;
    const footerSealX = width - 176;
    drawSeal(footerSealX, height - 151, footerSealSize, "道");
    ctx.textAlign = "right";
    ctx.fillStyle = "#7a6d5b";
    ctx.font = '22px "Songti SC", serif';
    ctx.fillText("合乎大道 · 道官署录", footerSealX - 28, height - 101);
    ctx.font = '15px "PingFang SC", sans-serif';
    ctx.fillText("生成之文，可入道论说", footerSealX - 28, height - 74);

    const link = document.createElement("a");
    link.download = buildCardDownloadFilename(levelTitle, new Date(), result);
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main data-persona={persona}>
      <div className="page-noise" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="合乎大道首页">
          <span className="brand-seal">道</span>
          <span>
            <strong>合乎大道</strong>
            <small>DAO DE</small>
          </span>
        </a>
        <nav aria-label="页面导航">
          <a href="#translator">问道</a>
          <a href="#skill">纳道</a>
          <a href="#principles">道法</a>
          <a href="#about">缘起</a>
        </nav>
        <div className="header-right">
          <div className="persona-wrapper" ref={personaMenuRef}>
            <button
              className="persona-toggle"
              onClick={() => setShowPersonaMenu((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={showPersonaMenu}
            >
              更换人物
            </button>
            {showPersonaMenu && (
              <div className="persona-dropdown" role="menu">
                {personas.map((p) => (
                  <button
                    key={p.id}
                    className={`persona-option${persona === p.id ? " active" : ""}`}
                    onClick={() => {
                      onPersonaChange(p.id);
                      setShowPersonaMenu(false);
                    }}
                    role="menuitem"
                  >
                    <span className="persona-mark">{p.mark}</span>
                    <span className="persona-label">{p.label}</span>
                    {persona === p.id && <span className="persona-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="header-note">大道自然 · 试行本</span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span />
          兼观自然百态与古贤论道之言
          <span />
        </div>
        <h1>
          把寻常的事
          <br />
          <em>说得合道自然</em>
        </h1>
        <p className="hero-copy">
          现代白话为骨，自然之道为法。
          <br />
          输入一句话，请老子替你说得合道自然。
        </p>
        <a className="hero-cta" href="#translator">
          入道问玄
          <Icon name="arrow" />
        </a>
        <div className="hero-orbit orbit-one" aria-hidden="true">
          <span>道</span>
        </div>
        <div className="hero-orbit orbit-two" aria-hidden="true">
          <span>德</span>
        </div>
        <div className="hero-side-note left">道法自然</div>
        <div className="hero-side-note right">上善若水</div>
      </section>

      <figure className="assembly-section" aria-labelledby="assembly-title">
        <div className="assembly-frame">
          <Image
            className="assembly-image"
            src="/images/laozi-assembly.jpg"
            alt="水墨山水间，一人独坐静观天地自然"
            width={2396}
            height={1500}
            sizes="(max-width: 680px) 100vw, (max-width: 1500px) 94vw, 1400px"
            loading="eager"
          />
          <div className="assembly-wash" aria-hidden="true" />
          <figcaption className="assembly-inscription">
            <span className="assembly-seal" aria-hidden="true">
              道
            </span>
            <div>
              <p>天地不言 · 万物自化</p>
              <h2 id="assembly-title">有情，请顺其自然说开</h2>
              <span>
                今日不论有事无事，
                <br />
                都可静下心来，观照本心。
              </span>
            </div>
          </figcaption>
          <span className="assembly-corner corner-top" aria-hidden="true" />
          <span className="assembly-corner corner-bottom" aria-hidden="true" />
        </div>
        <div className="assembly-footnote" aria-hidden="true">
          <span>观其道</span>
          <i />
          <span>顺其势</span>
          <i />
          <span>然后合道</span>
        </div>
      </figure>

      <section className="translator-section" id="translator">
        <div className="section-heading">
          <span className="section-number">
            <i>壹</i>
          </span>
          <div>
            <p>一言入道，万象相生</p>
            <h2>请说实话，再合天道</h2>
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
              placeholder="例如：朋友找我借钱不还，如何说才合乎天道……"
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
              <span>择其道气</span>
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
                <span className="field-title">道法探究</span>
                <span className="field-help">由微言到大道</span>
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
                {loading ? loadingLines[loadingIndex] : "请老子论道"}
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
                <span className="panel-label inverse">成道</span>
                <span className="result-style">
                  {selectedMode.title} ·{" "}
                  {levels.find((item) => item.id === level)?.title}
                </span>
              </div>
              <span className="result-seal" aria-hidden="true">
                合道
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
                    {copied ? "已录于竹简" : "抄录道言"}
                  </button>
                  <button type="button" onClick={downloadCard}>
                    <Icon name="download" />
                    生成道帖
                  </button>
                  <button type="button" onClick={translate}>
                    <Icon name="refresh" />
                    再论一次
                  </button>
                </div>
                <div className="result-meta">
                  <span>{isDemo ? "本地演示 · 配置 API 后启用大模型" : "DeepSeek 老子已阅"}</span>
                  {remaining !== null && (
                    <span>
                      近10分钟还可问道 {remaining} 次
                      {dailyRemaining !== null
                        ? ` · 今日还可问 ${dailyRemaining} 次`
                        : ""}
                      {retryAfterSeconds !== null
                        ? ` · 约 ${Math.ceil(retryAfterSeconds / 60)} 分钟后再问`
                        : ""}
                    </span>
                  )}
                </div>
                <p className="result-support">
                  若此器有用，可回{" "}
                  <a href={originalVideoUrl} target="_blank" rel="noreferrer">
                    原视频
                  </a>{" "}
                  赐一赞，以续道官香火。
                </p>
              </>
            ) : (
              <div className="empty-result">
                <span className="empty-glyph">道</span>
                <p>言未至，道未成</p>
                <small>
                  在左侧写下一句话
                  <br />
                  选择道气，再请老子论道
                </small>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="skill-section" id="skill">
        <div className="skill-heading">
          <div>
            <span className="eyebrow">请道归家 · 免费下载</span>
            <h2>把这套道法，<br />请进你自己的 AI</h2>
          </div>
          <p>
            不必每次打开网页，也不消耗本站的 API。
            一键复制 Skill 后，直接粘贴到任意 AI 聊天框里就能用；
            也可以下载后安装，让自己的 AI
            以退为进柔、反者道之动、无为而治或归根曰静。
          </p>
        </div>

        <div className="skill-layout">
          <article className="skill-package-card">
            <div className="skill-package-top">
              <span className="skill-knot" aria-hidden="true">道</span>
              <div>
                <small>AI SKILL · 试行第一版</small>
                <h3>speak-dadao</h3>
                <p>现代白话为骨，自然之道为法。</p>
              </div>
            </div>

            <div className="skill-capabilities" aria-label="Skill 能力">
              <span>以退为进柔</span>
              <span>反者道之动</span>
              <span>无为而治</span>
              <span>归根曰静</span>
            </div>

            <div className="skill-file-list">
              <span><i>文</i> SKILL.md</span>
              <span><i>令</i> agents/openai.yaml</span>
            </div>

            <div className="skill-actions">
              <button
                className="skill-copy-full"
                type="button"
                disabled={!mounted || !skillFullText}
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
                href="/downloads/speak-dadao-skill.zip"
                download
              >
                <span>
                  <strong>下载合乎大道 Skill</strong>
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
                    点击左侧"一键复制 Skill 全文"，直接粘贴进 AI
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
                      使用 $speak-dadao，把"朋友找我借钱不还，如何说才合乎天道"
                      改写成无为而治的微言。
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
            <p>并非玄之又玄</p>
            <h2>何谓真正合乎大道？</h2>
          </div>
        </div>
        <div className="principle-grid">
          <article>
            <span className="principle-index">01</span>
            <div className="principle-symbol">朴</div>
            <h3>抱朴守真</h3>
            <p>不绕弯子、不堆辞藻，让一句话本身就接近本质。</p>
          </article>
          <article>
            <span className="principle-index">02</span>
            <div className="principle-symbol">反</div>
            <h3>以反求正</h3>
            <p>不说"应该怎样"，而问"为什么不能反过来看"。</p>
          </article>
          <article>
            <span className="principle-index">03</span>
            <div className="principle-symbol">柔</div>
            <h3>柔弱胜刚</h3>
            <p>不用气势压人，用一句软话让人自己转弯。</p>
          </article>
          <article>
            <span className="principle-index">04</span>
            <div className="principle-symbol">静</div>
            <h3>归根曰静</h3>
            <p>把躁动拉回根本，安静了，道理自然浮现。</p>
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
          <h2>从天地万物的自然运行中，也从古贤论道的言语里，重新体悟大道。</h2>
        </div>
        <p>
          我们观察了山川草木的运行与人间百态的消长，
          也参考《道德经》《庄子》《列子》《淮南子》等道家典籍的白话译文：
          真正有力的不是争辩与名分，而是顺势而为、以柔克刚的自然之道。
          这个工具保留那份淡泊从容的幽默，也尽量让每句话合于自然、每件事回归本真。
        </p>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-seal">道</span>
          <span>
            <strong>合乎大道</strong>
            <small>言之合道，戏而自然</small>
          </span>
        </div>
        <div className="footer-note">
          <p>本工具用于语言娱乐与文化创作，生成内容请自行判断与核实。</p>
          <p>
            若此器有用，可回{" "}
            <a href={originalVideoUrl} target="_blank" rel="noreferrer">
              原视频
            </a>{" "}
            赐一赞；若有失道处，亦可在评论区进谏。
          </p>
          <p className="footer-sponsor">道席虚位，以待良朋。合作可循原视频寻制礼者。</p>
        </div>
        <div className="footer-right">
          <span>原网站作者 Aspirin0000 · 二〇二六</span>
          <a
            href={originalVideoUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="合乎大道 B 站原视频"
          >
            B站原视频
          </a>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="合乎大道官方 GitHub 仓库"
          >
            官方开源仓库
          </a>
        </div>
      </footer>
    </main>
  );
}
