# 合乎周礼

<p align="center">
  <strong>问礼 + 释礼：把寻常话写成周礼体，也把周礼体翻回直接人话。</strong>
</p>

<p align="center">
  <a href="https://www.bilibili.com/video/BV12a7N6qE1g/">B站原视频</a>
  ·
  <a href="https://hehuzhouli.com">在线体验</a>
  ·
  <a href="#quick-start">快速开始</a>
  ·
  <a href="#speak-zhouli-skill">下载 Skill</a>
  ·
  <a href="#deployment">部署</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-black">
  <img alt="Official" src="https://img.shields.io/badge/official-hehuzhouli.com-8b1e1e">
  <a href="https://github.com/Aspirin0000/zhouli-translator">
    <img alt="Official GitHub repository" src="https://img.shields.io/badge/GitHub-official_repo-black?logo=github">
  </a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6">
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-f38020">
</p>

![合乎周礼界面预览](public/images/zhouli-assembly.webp)

## What Is This

`合乎周礼` 是一个中文梗文案生成器，也是一个周礼体反向解释器。它支持两种方向：
问礼时，把普通中文改写成“大周礼时代”流行的白话翻译腔；释礼时，把周礼体翻回直接人话。
问礼会先讲一个看似古代的道理，再把现代小事放进礼法、名分、职分和体面里一本正经地论证；
释礼会拆掉这些包装，只保留原文真正想表达的意思。

在线版本：[hehuzhouli.com](https://hehuzhouli.com)

B站原视频：[B站原视频](https://www.bilibili.com/video/BV12a7N6qE1g/)

这是 [hehuzhouli.com](https://hehuzhouli.com) 原网站作者维护的官方开源仓库。
若你是从视频、网页、转载或镜像项目来到这里，这里就是原版网站对应的源码与
Skill 发布处。

这个仓库包含：

- Next.js 网站源码。
- `/api/translate` 服务端生成接口。
- `/api/event` 匿名交互反馈接口与 `/api/case` 主动授权案例接口。
- DeepSeek Chat Completions 调用逻辑。
- 官网与 B 站 Toy 共用的 Cloudflare Worker + D1 统计闭环。
- 问礼与释礼提示词构造与清洗规则。
- 可复制、可下载的 `speak-zhouli` Skill 包。
- 礼帖/释帖图片生成与下载逻辑。

仓库不包含真实 API Key、私有日志、线上账号凭据或生产平台的安全配置。

## Highlights

| Capability | Detail |
| --- | --- |
| 双向翻译 | 问礼生成周礼体，释礼把周礼体翻回直接人话 |
| 问礼模式 | 温言相劝、大儒辩经、强行圆场、痛心疾首 |
| 释礼模式 | 直白释义、耐心讲明、潜台词版、锐评拆穿 |
| 三档长度 | 小礼/成礼/大礼与略释/明释/详释，覆盖短评到长文 |
| 演示模式 | 没有 API Key 时仍可预览界面与交互 |
| Skill 分发 | 支持一键复制 Skill 全文和 ZIP 下载 |
| 图片导出 | 将问礼结果保存为礼帖，将释礼结果保存为释帖 |
| 匿名反馈 | 记录运行指标、复制/再生成和正负反馈，不默认保存输入输出 |
| 提示词实验 | A/B 只比较提示词版本，可按配置关闭 |
| 公开前审计 | 内置脚本扫描明显密钥与私钥块 |

## Star History

<a href="https://github.com/Aspirin0000/zhouli-translator/stargazers">
  <img alt="诸贤赐星记" src="public/images/github-star-history-zhouli.svg">
</a>

## Example

### 问礼示例

Input:

```text
疯狂星期四，谁愿请我一食才合乎周礼
```

Output style:

```text
我听闻，古人设宴，并非只为一餐之饱，也是借饭食来观朋友情义。
今日正逢星期四，我开口求一食，看似嘴馋，其实是在给诸位一个行仁义、修情分的机会。
若有人愿意请客，便不是破费，而是以鸡会友，这难道不也合乎周礼吗？
```

### 释礼示例

Input:

```text
我听闻，今日我设此礼门，并非拒人千里，只是怕众人一拥而入，坏了满座通畅。
```

Output style:

```text
我设置次数限制不是为了故意拦人，而是怕接口被刷爆，影响正常用户使用。
```

## Quick Start

Requirements:

- Node.js 20 or newer.
- A DeepSeek API key for real generation.

Run locally:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`.env.local`:

```env
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-v4-flash
MAX_OUTPUT_TOKENS=720
```

If `DEEPSEEK_API_KEY` is missing, the app falls back to local demo output and
does not call DeepSeek.

## Project Structure

```text
app/
  api/translate/route.ts       Server-side generation endpoint
  api/event/route.ts            Anonymous interaction endpoint
  api/case/route.ts             Explicitly authorized case submission
  privacy/page.tsx              Privacy and anonymous analytics notice
  page.tsx                     Main UI and card export flow
lib/
  prompt.ts                    问礼/释礼 prompt assembly and perspective rules
  analytics*.ts                Client allowlists, D1 writes, and runtime bindings
  feedback-*.ts                HMAC token and payload validation
  cardDownload.ts              Unique card download filenames
migrations/
  0001_create_analytics.sql    D1 schema for metrics, interactions, and cases
analytics/queries/              Read-only reporting and retention SQL
public/
  downloads/                   Public Skill assets
  images/                      README and website images
scripts/
  public-audit.mjs             Public-release secret scan
  run-zhouli-batch.mjs         Batch regression runner
  *.test.ts                    Unit and public-asset regression tests
skill-package/
  speak-zhouli/                Source Skill package
```

## DeepSeek Runtime

The production generation path:

1. The browser submits text, direction, mode, plainMode, level, and a bounded client surface marker to `/api/translate`.
2. The server validates input length, direction, mode, plainMode, level, surface, and release channel.
3. A lightweight in-memory rate limiter checks the request.
4. The server chooses prompt A/B only when the experiment flag is enabled, then builds a direction-specific prompt.
5. DeepSeek returns a candidate response; the Worker returns a random `response_id` and signed feedback token.
6. Aggregate generation metrics are written to D1 in the background. A D1 failure never blocks the result.
7. `/api/event` verifies the token and records copy, regenerate, and one quality feedback event per result.
8. `/api/case` stores input/output only after explicit consent, with a 60-day retention deadline.

The request shape keeps `direction, plainMode` explicit so the browser can switch
between 问礼 and 释礼 without adding a second endpoint.

Default runtime choices:

- Model: `deepseek-v4-flash`.
- Thinking mode: disabled.
- User input limit: 300 Chinese characters for 问礼, 900 Chinese characters for 释礼.
- Output limit: configured by `MAX_OUTPUT_TOKENS`.
- API Key scope: server only, never sent to the browser.

Analytics is off by default in local configuration. Production enables it only after the D1 migration and
`RESPONSE_FEEDBACK_SECRET` are configured. The full data boundary is documented at
[`/privacy`](https://hehuzhouli.com/privacy), and executable queries live under `analytics/queries/`.

For multi-instance production deployments, replace the in-memory rate limiter
with shared storage such as Redis, Upstash, D1, or KV, and configure platform
side abuse controls and billing alerts.

## Speak Zhouli Skill

The website ships a standalone `speak-zhouli` Skill. It keeps the public name for compatibility,
but now covers both directions: ask it to `问礼` for Zhouli-style writing, or `释礼` / `翻回人话`
to explain a Zhouli-style paragraph directly.

| Asset | Path |
| --- | --- |
| Skill source | `skill-package/speak-zhouli/` |
| Website copy source | `public/downloads/speak-zhouli-SKILL.md` |
| Website ZIP download | `public/downloads/speak-zhouli-skill.zip` |
| Public copy URL | `/downloads/speak-zhouli-SKILL.md` |
| Public ZIP URL | `/downloads/speak-zhouli-skill.zip` |

After editing the Skill source, rebuild the public assets:

```bash
cp skill-package/speak-zhouli/SKILL.md public/downloads/speak-zhouli-SKILL.md
cd skill-package
zip -r -X ../public/downloads/speak-zhouli-skill.zip speak-zhouli
```

## Quality Checks

Run the same checks used before release:

```bash
npm run public:audit
npm test
npm run typecheck
npm run build
```

`npm run public:audit` scans Git-tracked text files for obvious API keys,
literal bearer tokens, private key blocks, and Cloudflare credential
assignments. It is a guardrail, not a replacement for manual review.

Batch regression runner:

```bash
ZHOULI_TEST_ENDPOINT=http://localhost:3000/api/translate \
  node scripts/run-zhouli-batch.mjs
```

Use a private baseline by passing a compatible JSON file:

```bash
node scripts/run-zhouli-batch.mjs test-runs/your-baseline.json
```

`test-runs/` is ignored by Git and is intended for private regression samples
and real API outputs.

## Deployment

### Cloudflare Workers

This project has a server endpoint, so Cloudflare Workers + OpenNext is the
recommended Cloudflare path.

```bash
npm install
npx wrangler login
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put RESPONSE_FEEDBACK_SECRET
npx wrangler d1 migrations apply zhouli-analytics --remote
npm run deploy
```

The public website and B 站 Toy are two clients of the same Worker. The generated Toy package,
local Toy adapter, and publishing credentials are intentionally excluded from the public source release.

Local Workers preview:

```bash
cp .env.example .dev.vars
npm run preview
```

Do not commit real `.env`, `.env.local`, or `.dev.vars` files. Production
secrets should be stored with the hosting platform's secret manager.

### Vercel

1. Import the repository into Vercel.
2. Add `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, and `MAX_OUTPUT_TOKENS`.
3. Deploy.

### Self-Hosted Node

```bash
npm install
npm run build
npm run start
```

For production, run behind HTTPS and a process manager such as PM2 or systemd.

## Security Notes

- Never commit real API keys or platform tokens.
- Keep private request logs and batch outputs outside Git.
- Add shared rate limiting before high-traffic public deployments.
- Configure billing alerts on the model provider and hosting platform.
- Review [OPEN_SOURCE.md](OPEN_SOURCE.md) before changing repository visibility.

## Contributing

Issues and pull requests are welcome. Useful contributions include:

- Better prompt tests and regression samples.
- More robust safety and perspective handling.
- UI accessibility fixes.
- Deployment recipes for other platforms.
- Documentation improvements for new users.

Please run `npm run public:audit`, `npm test`, `npm run typecheck`, and
`npm run build` before opening a pull request.

## License

MIT License. See [LICENSE](LICENSE).
