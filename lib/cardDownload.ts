function toShanghaiParts(date: Date) {
  const shanghaiDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const iso = shanghaiDate.toISOString();
  return {
    date: iso.slice(0, 10).replaceAll("-", ""),
    time: iso.slice(11, 19).replaceAll(":", ""),
  };
}

function sanitizeFilenamePart(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|\s]+/g, "")
    .replace(/[.。]+$/g, "")
    .slice(0, 12);
  return cleaned || "成礼";
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

export function buildCardDownloadFilename(
  levelTitle: string,
  date = new Date(),
  result = "",
) {
  const parts = toShanghaiParts(date);
  const title = sanitizeFilenamePart(levelTitle);
  const digest = shortHash(`${levelTitle}\n${parts.date}\n${parts.time}\n${result}`);
  return `儒释道-${title}-${parts.date}-${parts.time}-${digest}.png`;
}
