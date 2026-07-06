import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Persona = "confucius" | "laozi" | "zen";
export type ZhouliMode = "gentle" | "debate" | "defend" | "lament";
export type ZhouliLevel = "light" | "standard" | "grand";

const SKILL_DIR = join(process.cwd(), "skill-package");

const skillFileMap: Record<Persona, string> = {
  confucius: join(SKILL_DIR, "speak-zhouli", "SKILL.md"),
  laozi: join(SKILL_DIR, "speak-dadao", "SKILL.md"),
  zen: join(SKILL_DIR, "speak-chan", "SKILL.md"),
};

const modeTitleMap: Record<Persona, Record<ZhouliMode, string>> = {
  confucius: { gentle: "温言相劝", debate: "大儒辩经", defend: "强行圆场", lament: "痛心疾首" },
  laozi: { gentle: "守柔", debate: "反者", defend: "无为", lament: "归根" },
  zen: { gentle: "棒喝", debate: "平常", defend: "参话", lament: "直指" },
};

const levelTitleMap: Record<Persona, Record<ZhouliLevel, string>> = {
  confucius: { light: "小礼", standard: "成礼", grand: "大礼" },
  laozi: { light: "短章", standard: "成道", grand: "长篇" },
  zen: { light: "一句", standard: "一顿", grand: "三喝" },
};

const skillCache: Partial<Record<Persona, string>> = {};

function loadSkill(persona: Persona): string {
  if (!skillCache[persona]) {
    skillCache[persona] = readFileSync(skillFileMap[persona], "utf-8");
  }
  return skillCache[persona]!;
}

export function getSystemPrompt(persona: Persona): string {
  return loadSkill(persona);
}

export function buildUserPrompt(
  text: string,
  mode: ZhouliMode,
  level: ZhouliLevel,
  persona: Persona,
): string {
  const modeTitle = modeTitleMap[persona][mode];
  const levelTitle = levelTitleMap[persona][level];
  return `请用${modeTitle}的方式，${levelTitle}，改写下面这句话：\n\n${text}`;
}
