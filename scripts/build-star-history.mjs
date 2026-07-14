import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = process.env.STAR_HISTORY_REPO || "Aspirin0000/zhouli-translator";
const outputPath =
  process.env.STAR_HISTORY_OUTPUT ||
  path.join("public", "images", "github-star-history-zhouli.svg");
const historyPath =
  process.env.STAR_HISTORY_DATA ||
  path.join("public", "images", "github-star-history-zhouli.json");
const timeZone = "Asia/Shanghai";
const githubToken = process.env.STAR_HISTORY_TOKEN || process.env.GITHUB_TOKEN;
const maxSvgPoints = Math.max(
  80,
  Number.parseInt(process.env.STAR_HISTORY_MAX_POINTS || "600", 10) || 600,
);
const hanDigits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const hanYearDigits = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

async function requestJson(url, accept = "application/vnd.github+json") {
  const headers = {
    Accept: accept,
    "User-Agent": "zhouli-translator-star-history",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const response = await fetch(url, {
    headers,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}${body ? ` (${body})` : ""}`);
  }

  return JSON.parse(body);
}

async function fetchAllStargazers() {
  const stargazers = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repo}/stargazers?per_page=100&page=${page}`;
    const items = await requestJson(url, "application/vnd.github.star+json");
    stargazers.push(...items);

    if (items.length < 100) break;
    page += 1;
  }

  return stargazers
    .filter((item) => typeof item.starred_at === "string")
    .sort((a, b) => Date.parse(a.starred_at) - Date.parse(b.starred_at));
}

async function readHistory() {
  try {
    const data = JSON.parse(await readFile(historyPath, "utf8"));
    return Array.isArray(data.starredAt)
      ? data.starredAt.filter((value) => Number.isFinite(Date.parse(value)))
      : [];
  } catch {
    return [];
  }
}

async function fetchRecentStarEvents(latestKnownTime) {
  const starredAt = [];
  let page = 1;

  while (page <= 10) {
    const items = await requestJson(
      `https://api.github.com/repos/${repo}/events?per_page=100&page=${page}`,
    );
    if (!Array.isArray(items) || items.length === 0) break;

    let reachedKnownHistory = false;
    for (const item of items) {
      if (item.type !== "WatchEvent" || item.payload?.action !== "started") continue;
      const createdAt = item.created_at;
      if (typeof createdAt !== "string") continue;
      if (latestKnownTime && Date.parse(createdAt) <= latestKnownTime) {
        reachedKnownHistory = true;
        continue;
      }
      starredAt.push(createdAt);
    }

    if (reachedKnownHistory || items.length < 100) break;
    page += 1;
  }

  return starredAt;
}

async function collectStarHistory(repoInfo) {
  try {
    const stargazers = await fetchAllStargazers();
    return stargazers.map((item) => item.starred_at);
  } catch (error) {
    const existing = await readHistory();
    const latestKnownTime = existing.reduce(
      (latest, value) => Math.max(latest, Date.parse(value)),
      0,
    );
    const recentEvents = await fetchRecentStarEvents(latestKnownTime);
    const merged = [...existing, ...recentEvents];
    const unique = [...new Set(merged)].sort((a, b) => Date.parse(a) - Date.parse(b));

    console.warn(`Stargazer endpoint unavailable; using event fallback: ${error.message}`);
    return unique;
  }
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

function getShanghaiDateParts(value) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(value);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function toHanNumber(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return "";
  if (number === 0) return hanDigits[0];
  if (number < 0) return `负${toHanNumber(Math.abs(number))}`;

  const sectionUnits = ["", "万", "亿", "兆"];
  const digitUnits = ["", "十", "百", "千"];
  const sections = [];
  let remaining = number;

  while (remaining > 0) {
    sections.unshift(remaining % 10000);
    remaining = Math.floor(remaining / 10000);
  }

  function formatSection(section) {
    const chars = String(section).padStart(4, "0").split("").map(Number);
    let sectionText = "";
    let pendingZero = false;

    chars.forEach((digit, index) => {
      const position = chars.length - index - 1;
      if (digit === 0) {
        pendingZero = sectionText.length > 0 && position > 0;
        return;
      }
      if (pendingZero) sectionText += hanDigits[0];
      sectionText += `${hanDigits[digit]}${digitUnits[position]}`;
      pendingZero = false;
    });

    return sectionText.replace(/^一十/, "十");
  }

  let text = "";
  let pendingZero = false;

  sections.forEach((section, index) => {
    const unitIndex = sections.length - index - 1;
    if (section === 0) {
      pendingZero = text.length > 0;
      return;
    }

    if (pendingZero || (text.length > 0 && section < 1000)) text += hanDigits[0];
    text += `${formatSection(section)}${sectionUnits[unitIndex] ?? ""}`;
    pendingZero = false;
  });

  return text;
}

function toHanYear(value) {
  return String(value)
    .split("")
    .map((char) => hanYearDigits[Number(char)])
    .join("");
}

function formatRiteDate(value, includeYear = false) {
  const { year, month, day } = getShanghaiDateParts(value);
  const dayText = day <= 10 ? `初${toHanNumber(day)}` : toHanNumber(day);
  const dateText = `${toHanNumber(month)}月${dayText}`;
  return includeYear ? `${toHanYear(year)}年${dateText}` : dateText;
}

function niceMax(value) {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function buildTicks(min, max, count) {
  return Array.from({ length: count }, (_, index) => {
    if (count === 1) return min;
    return min + ((max - min) * index) / (count - 1);
  });
}

function buildDateTicks(min, max) {
  const oneDay = 24 * 60 * 60 * 1000;
  const range = max - min;

  if (!Number.isFinite(range) || range <= 0) return [min];

  if (range <= oneDay * 5.5) {
    const start = getShanghaiDateParts(new Date(min));
    const firstUtc = Date.UTC(start.year, start.month - 1, start.day) - 8 * 60 * 60 * 1000;
    const ticks = [];

    for (let time = firstUtc; time <= max + oneDay; time += oneDay) {
      if (time >= min - oneDay * 0.2 && time <= max + oneDay * 0.2) {
        ticks.push(time);
      }
    }

    if (ticks.length > 0 && ticks.length <= 6) return ticks;
  }

  return buildTicks(min, max, 6);
}

function sampleLinePoints(points, maxPoints) {
  if (points.length <= maxPoints) return points;

  const lastIndex = points.length - 1;
  const sampled = [];
  let previousIndex = -1;

  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    if (pointIndex !== previousIndex) {
      sampled.push(points[pointIndex]);
      previousIndex = pointIndex;
    }
  }

  return sampled;
}

function buildSvg({ repoInfo, stargazers, generatedAt }) {
  const width = 920;
  const height = 520;
  const starTimes = stargazers.map((item) => Date.parse(item.starred_at));
  const starCount = repoInfo.stargazers_count ?? stargazers.length;
  const firstTime = starTimes.at(0) ?? Date.parse(repoInfo.created_at);
  const latestTime = starTimes.at(-1) ?? generatedAt.getTime();
  const rangePadding = Math.max(2 * 60 * 60 * 1000, (latestTime - firstTime) * 0.08);
  const minTime = Math.min(firstTime, latestTime) - rangePadding;
  const maxTime = Math.max(generatedAt.getTime(), latestTime + rangePadding);
  const yMax = niceMax(Math.max(1, starCount));
  const yTicks = buildTicks(0, yMax, 6);
  const yTickLabels = yTicks.map((tick) => toHanNumber(Math.round(tick)));
  const widestYLabel = yTickLabels.reduce(
    (widest, label) => (label.length > widest.length ? label : widest),
    "",
  );
  const headerLeft = 92;
  const mainFrame = {
    outerX: 38,
    outerY: 104,
    innerX: 50,
    innerY: 116,
    bottomInset: 38,
    innerBottomInset: 54,
  };
  const xLabelY = height - 74;
  const footerY = height - 26;
  const margin = {
    top: 124,
    right: 118,
    bottom: 128,
    left: Math.max(120, Math.min(168, 92 + widestYLabel.length * 13)),
  };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const x = (time) => margin.left + ((time - minTime) / (maxTime - minTime)) * chartWidth;
  const y = (value) => margin.top + chartHeight - (value / yMax) * chartHeight;

  const linePoints = [[x(minTime), y(0)]];
  stargazers.forEach((item, index) => {
    linePoints.push([x(Date.parse(item.starred_at)), y(index + 1)]);
  });
  linePoints.push([x(maxTime), y(stargazers.length || 0)]);
  const sampledLinePoints = sampleLinePoints(linePoints, maxSvgPoints);

  const areaPoints = [
    `${x(minTime).toFixed(2)},${y(0).toFixed(2)}`,
    ...sampledLinePoints.map(([pointX, pointY]) => `${pointX.toFixed(2)},${pointY.toFixed(2)}`),
    `${x(maxTime).toFixed(2)},${y(0).toFixed(2)}`,
  ].join(" ");
  const polylinePoints = sampledLinePoints
    .map(([pointX, pointY]) => `${pointX.toFixed(2)},${pointY.toFixed(2)}`)
    .join(" ");

  const xTicks = buildDateTicks(minTime, maxTime);
  const updatedText = formatRiteDate(generatedAt, true);
  const starText = toHanNumber(starCount);
  const subtitleFontSize = Math.max(11, 14 - Math.max(0, starText.length - 8) * 0.45);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">诸贤赐星记 for ${escapeXml(repo)}</title>
  <desc id="desc">${escapeXml(repo)} has ${starCount} GitHub stars. Chart generated from public GitHub stargazer timestamps.</desc>
  <defs>
    <linearGradient id="line" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#7d2017"/>
      <stop offset="58%" stop-color="#b33426"/>
      <stop offset="100%" stop-color="#d65a32"/>
    </linearGradient>
    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#b33426" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#b33426" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="paper" cx="45%" cy="18%" r="82%">
      <stop offset="0%" stop-color="#fff8ea"/>
      <stop offset="58%" stop-color="#f3e2c4"/>
      <stop offset="100%" stop-color="#dfc79e"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#3b2a20" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" rx="18" fill="#f4ead8"/>
  <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="12" fill="url(#paper)" stroke="#d8b783" filter="url(#shadow)"/>
  <rect x="${mainFrame.outerX}" y="${mainFrame.outerY}" width="${width - mainFrame.outerX * 2}" height="${height - mainFrame.outerY - mainFrame.bottomInset}" fill="none" stroke="#8c6b3f" stroke-opacity="0.42" stroke-width="1.5"/>
  <rect x="${mainFrame.innerX}" y="${mainFrame.innerY}" width="${width - mainFrame.innerX * 2}" height="${height - mainFrame.innerY - mainFrame.innerBottomInset}" fill="none" stroke="#fff7e5" stroke-opacity="0.72"/>
  <text x="${width / 2}" y="${height / 2 + 44}" text-anchor="middle" fill="#8c342a" fill-opacity="0.06" font-family="Songti SC, STSong, SimSun, serif" font-size="280" font-weight="700">礼</text>
  <text x="${headerLeft}" y="58" fill="#211d18" font-family="Songti SC, STSong, SimSun, serif" font-size="34" font-weight="700">诸贤赐星记</text>
  <text x="${headerLeft}" y="84" fill="#7a6247" font-family="Songti SC, STSong, SimSun, serif" font-size="${subtitleFontSize.toFixed(1)}">${escapeXml(repo)} · 凡${escapeXml(starText)}星 · 更新于 ${escapeXml(updatedText)}</text>
  <rect x="${width - 108}" y="44" width="46" height="46" fill="#9e3228"/>
  <rect x="${width - 100}" y="52" width="30" height="30" fill="none" stroke="#f6dfba" stroke-width="1.5"/>
  <text x="${width - 85}" y="74" text-anchor="middle" fill="#f6dfba" font-family="Songti SC, STSong, SimSun, serif" font-size="20" font-weight="700">星</text>
  <text x="60" y="${margin.top + 42}" text-anchor="middle" fill="#8b1e1e" font-family="Songti SC, STSong, SimSun, serif" font-size="16" writing-mode="vertical-rl">贤星累牍</text>
  ${yTicks
    .map((tick, index) => {
      const tickY = y(tick);
      return `<line x1="${margin.left}" y1="${tickY.toFixed(2)}" x2="${width - margin.right}" y2="${tickY.toFixed(2)}" stroke="#d9c29e" stroke-opacity="0.48"/>
  <text x="${margin.left - 14}" y="${(tickY + 4).toFixed(2)}" text-anchor="end" fill="#7a6247" font-family="Songti SC, STSong, SimSun, serif" font-size="13">${escapeXml(yTickLabels[index])}</text>`;
    })
    .join("\n  ")}
  ${xTicks
    .map((tick) => {
      const tickX = Math.min(Math.max(x(tick), margin.left), width - margin.right);
      return `<line x1="${tickX.toFixed(2)}" y1="${margin.top}" x2="${tickX.toFixed(2)}" y2="${height - margin.bottom}" stroke="#ead6b7" stroke-opacity="0.54"/>
  <text x="${tickX.toFixed(2)}" y="${xLabelY}" text-anchor="middle" fill="#7a6247" font-family="Songti SC, STSong, SimSun, serif" font-size="14">${escapeXml(formatRiteDate(new Date(tick)))}</text>`;
    })
    .join("\n  ")}
  <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#6c4f2e" stroke-width="1.6"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#6c4f2e" stroke-width="1.6"/>
  <polygon points="${areaPoints}" fill="url(#area)"/>
  <polyline points="${polylinePoints}" fill="none" stroke="#f3d7a2" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.72"/>
  <polyline points="${polylinePoints}" fill="none" stroke="url(#line)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(latestTime).toFixed(2)}" cy="${y(stargazers.length || 0).toFixed(2)}" r="7" fill="#9e3228" stroke="#f7ead1" stroke-width="3"/>
  <text x="${width / 2}" y="${footerY}" text-anchor="middle" fill="#9b8361" font-family="Songti SC, STSong, SimSun, serif" font-size="12">据 GitHub 公开赐星时刻绘制</text>
</svg>
`;
}

const repoInfo = await requestJson(`https://api.github.com/repos/${repo}`);
let starredAt = await collectStarHistory(repoInfo);
const starCount = repoInfo.stargazers_count ?? starredAt.length;
const latestKnown = starredAt.at(-1);

// Events can be delayed or omitted by GitHub's rolling event feed. Keep the
// chart honest about the current count while preserving all known timestamps.
while (starredAt.length < starCount) {
  starredAt.push(latestKnown || new Date().toISOString());
}

starredAt = starredAt.slice(-Math.max(starCount, 1)).sort((a, b) => Date.parse(a) - Date.parse(b));
const stargazers = starredAt.map((starred_at) => ({ starred_at }));
const svg = buildSvg({ repoInfo, stargazers, generatedAt: new Date() });

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");
await writeFile(
  historyPath,
  `${JSON.stringify({ repo, starredAt }, null, 2)}\n`,
  "utf8",
);

console.log(`Wrote ${outputPath} with ${repoInfo.stargazers_count ?? stargazers.length} stars.`);
