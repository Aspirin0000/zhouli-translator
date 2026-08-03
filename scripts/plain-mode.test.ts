import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildPlainPrompt, buildUserPrompt, type PlainMode } from "../lib/prompt.ts";

test("restores roast plain mode with semantic guardrails", () => {
  const prompt = buildPlainPrompt(
    "我听闻，宾客既已入席，便该投币以谢主人。",
    "standard",
    "roast" as PlainMode,
  );

  assert.match(prompt, /锐评拆穿/);
  assert.match(prompt, /只拆文本里已有的话术/);
  assert.match(prompt, /不要新增罪名/);
});

test("plain prompt requires semantic preservation over extra judgment", () => {
  const prompt = buildPlainPrompt(
    "我听闻，诸事若问如何体面，便当先明其本意。",
    "standard",
    "subtext",
  );

  assert.match(prompt, /不确定时/);
  assert.match(prompt, /只能说“可能是在|只能说“像是在/);
  assert.match(prompt, /不要继续代写/);
  assert.match(prompt, /不能把请求改成审判/);
});

test("client and API expose roast plain mode", () => {
  const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const routeSource = readFileSync(
    new URL("../app/api/translate/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /锐评拆穿/);
  assert.match(pageSource, /id:\s*"roast"/);
  assert.match(routeSource, /"roast"/);
});

test("direction switch clears stale input and result state", () => {
  const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /if \(direction === item\.id\) return;/);
  assert.match(pageSource, /setDirection\(item\.id\);[\s\S]{0,120}setText\(""\);/);
  assert.match(pageSource, /setText\(""\);[\s\S]{0,120}setResult\(""\);/);
  assert.match(pageSource, /setResult\(""\);[\s\S]{0,120}setError\(""\);/);
});

test("zhouli prompt keeps wording requests reversible", () => {
  const prompt = buildUserPrompt(
    "朋友说老师写得太像AI了，我想回他：这事到底该怎么说才体面",
    "defend",
    "light",
  );

  assert.match(prompt, /语义可逆/);
  assert.match(prompt, /输出必须改写这个请求本身/);
  assert.match(prompt, /求一个体面说法/);
  assert.match(prompt, /不能改成夸奖、洗白或自我辩护/);
  assert.match(prompt, /朋友\/网友说的是某对象/);
  assert.match(prompt, /被评价对象是否仍是老师/);
  assert.match(prompt, /引号里那句话的核心对象/);
  assert.match(prompt, /热梗锚点自检/);
});

test("plain prompt preserves quoted wording targets and safety intent", () => {
  const prompt = buildPlainPrompt(
    "我听闻，若要把“DeepSeek 输出有点包的但还挺有意思”说得体面，须先守住DeepSeek这件器物的名分。",
    "grand",
    "explain",
  );

  assert.match(prompt, /待处理句子/);
  assert.match(prompt, /关键对象和评价/);
  assert.match(prompt, /安全意图/);
});

test("plain prompt asks for casual netizen speech instead of report-style explanation", () => {
  const prompt = buildPlainPrompt(
    "我听闻，从前有人在集市上喊天上有龙，众人便忘了手边正事。",
    "grand",
    "explain",
  );

  assert.match(prompt, /像网友顺手解释/);
  assert.match(prompt, /不要输出报告式标签/);
  assert.match(prompt, /不要用“我其实是在说”/);
  assert.match(prompt, /可以有一点吐槽/);
  assert.match(prompt, /不要默认放在开头/);
  assert.match(prompt, /不要用序号分条/);
});

test("plain output starts directly with meaning and keeps first-person perspective", () => {
  const prompt = buildPlainPrompt(
    "我听闻，今日我设此礼门，并非拒人千里，只是怕众人一拥而入，坏了满座通畅。",
    "standard",
    "direct",
  );
  const routeSource = readFileSync(
    new URL("../app/api/translate/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(prompt, /第一句直接进入释义/);
  assert.match(prompt, /禁止以“这段话的意思是/);
  assert.match(prompt, /原文是第一人称，输出也必须直接用第一人称/);
  assert.match(routeSource, /stripPlainPreamble/);
  assert.match(routeSource, /人话说就是/);
});

test("plain prompt permits direct short explanations for single characters", () => {
  const prompt = buildPlainPrompt("善", "light", "direct");

  assert.match(prompt, /单字|短句/);
  assert.match(prompt, /1到20字|不必凑字数/);
});

test("API guards against visibly incomplete model output", () => {
  const routeSource = readFileSync(
    new URL("../app/api/translate/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /assessGeneratedText/);
  assert.match(routeSource, /buildIncompleteRetryInstruction/);
  assert.match(routeSource, /finish_reason/);
  assert.match(routeSource, /此言尚未成礼/);
});

test("plain API allows very short valid explanations for one-character inputs", () => {
  const routeSource = readFileSync(
    new URL("../app/api/translate/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /getMinimumResultLength/);
  assert.match(routeSource, /SHORT_PLAIN_RESULTS/);
  assert.match(routeSource, /善[\s\S]{0,80}好/);
  assert.match(routeSource, /可也[\s\S]{0,80}可以/);
  assert.doesNotMatch(routeSource, /isPlainDirection \? 16 : level === "light"/);
});

test("zhouli prompt classifies reply and explanation requests", () => {
  const replyPrompt = buildUserPrompt(
    "不懂就问，贴吧楼中楼说问礼次数提示属于“啊对对对”，这话怎么回才体面",
    "gentle",
    "light",
  );
  const explainPrompt = buildUserPrompt(
    "如果后端接口被人评价为“预制文案”，怎么解释才不显得硬洗",
    "gentle",
    "light",
  );

  assert.match(replyPrompt, /本句视角判定：请求改述/);
  assert.match(explainPrompt, /如何解释才不显硬洗/);
});
