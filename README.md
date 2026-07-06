# 儒释道 · 合乎周礼 / 合乎大道 / 合乎禅机

<p align="center">
  <strong>把寻常的话，翻译成一本正经、略显荒唐、但又有礼有据的周礼白话翻译腔（以及大道自然腔、禅机棒喝腔）。</strong>
</p>

<p align="center">
  <a href="https://www.bilibili.com/video/BV12a7N6qE1g/">B站原视频</a>
  ·
  <a href="https://hehuzhouli.com">在线体验</a>
  ·
  <a href="#quick-start">快速开始</a>
  ·
  <a href="#development-history">开发历程</a>
</p>

---

## 项目概述

基于 Next.js 16 的中文互联网梗文化文本生成器。用户输入一段大白话，AI 将其改写成特定文化角色的口吻，支持**儒（孔子/周礼）、道（老子/大道）、释（禅宗/禅机）** 三种人格切换。

本项目源自 Bilibili 热门视频，最初仅有孔子"合乎周礼"一个角色，后扩展为儒释道三合一架构。

角色对比：

| 角色 | ID | 色系 | 核心概念 | 品牌名 | 修辞模式 | 等级制 |
|------|----|------|----------|--------|----------|--------|
| 孔子 | confucius | 朱红 #9e3228 | 礼 | 合乎周礼 | 温言相劝 / 大儒辩经 / 强行圆场 / 痛心疾首 | 小礼 / 成礼 / 大礼 |
| 老子 | laozi | 黛绿 #6b7d5e | 道 | 合乎大道 | 以退为进柔 / 反者道之动 / 无为而治 / 归根曰静 | 微言 / 常道 / 大道 |
| 禅宗 | zen | 枯墨灰 #5c5c5c | 禅 | 合乎禅机 | 截断妄见 / 看脚下路 / 吾心明月 / 当下即是 | 棒喝 / 见性 / 彻悟 |

---

## Highlights

| Capability | Detail |
| --- | --- |
| 三档礼数 | 覆盖短评到长文 |
| 四种辞气 | 每种人格独立四套修辞模式 |
| 演示模式 | 无 API Key 时按人格返回对应风格演示文案 |
| 人格隔离 | API 回复（安全拦截/审计/演示/回退）全部按人格差异化 |
| Skill 分发 | 三人格独立 SKILL.md + ZIP 下载包 |
| Canvas 礼帖 | 手工绘制卡片（文字换行、纸纹纹理、装饰角、印章），无 html2canvas |
| 公开前审计 | 内置脚本扫描密钥与私钥块 |

---

## Quick Start

Requirements:

- Node.js 20+
- DeepSeek API key（可选，无 key 时进入演示模式）

```bash
npm install
cp .env.example .env.local
npm run dev -- --webpack
```

`.env.local`:
- 需要先有api。
```env
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-v4-flash
MAX_OUTPUT_TOKENS=720
```

---

## 技术栈

| 层次 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.9 |
| UI | React | 19.2.0 |
| 语言 | TypeScript | 5.9.3 |
| 部署 | Cloudflare Workers (OpenNext) | — |
| AI | DeepSeek Chat Completions | deepseek-v4-flash |
| 测试 | node:test + node:assert | — |
| 样式 | 纯手写 CSS（无 Tailwind / 无外部 UI 库） | — |

---

## 项目结构

```
project-root/
├── app/
│   ├── api/translate/route.ts    # POST /api/translate AI 生成端点
│   ├── globals.css               # 全局样式 + 三人格 CSS 变量覆盖
│   ├── layout.tsx                # 根布局
│   └── page.tsx                  # 主页面容器（按 persona 动态加载模板）
├── personas/                     # 人物前端模板
│   ├── types.ts                  # Persona 类型定义
│   ├── confucius/index.tsx       # 孔子完整页面（~1350 行）
│   ├── laozi/index.tsx           # 老子完整页面（~1355 行）
│   └── zen/index.tsx             # 禅宗完整页面（~1337 行）
├── lib/
│   ├── personaContent.ts         # 三人格 6 类回复文案统一管理
│   ├── prompt.ts                 # 运行时读 SKILL.md 作为 system prompt
│   └── cardDownload.ts           # 卡片下载文件名生成
├── skill-package/
│   ├── speak-zhouli/             # 孔子 Skill 包
│   ├── speak-dadao/              # 老子 Skill 包
│   └── speak-chan/               # 禅宗 Skill 包
├── public/
│   ├── downloads/                # 三人格独立 SKILL.md + ZIP
│   └── images/                   # 三人格专属大图
├── scripts/
│   ├── public-audit.mjs          # 发布前密钥扫描
│   └── run-zhouli-batch.mjs      # 批量回归测试
├── ai-docs/                      # AI 开发文档
│   ├── AI_GUIDE.md               # AI 开发指南
│   ├── template-rules.md         # 新角色模板生成规则
│   └── changelogs/               # 各版本改动记录
└── .env.example
```

---

## 核心架构

### 请求流程

1. 用户选择人格（儒/道/释）+ 修辞模式 + 等级 + 输入文本
2. 前端 POST 到 `/api/translate`，payload 包含 `persona`、`text`、`mode`、`level`
3. 服务端依次执行：**请求验证 → 频率限制 → 安全过滤 → AI 调用（按 persona 选用对应 SKILL.md 作为 system prompt）→ 结果清洗**
4. 返回结果，前端按当前人格展示对应风格的回复

### System Prompt 机制

API 调用 DeepSeek 时只传两条消息：

- **System**：对应人格的完整 `SKILL.md` 原文（进程启动时 `fs.readFileSync` 读取一次并缓存）
- **User**：`请用{辞气}的方式，{篇幅}，改写下面这句话：\n\n{用户输入}`

不允许在 SKILL.md 之外附加额外规则。三人格的提示词相互独立，禁止串用核心词汇。

### 人格回复差异化（`lib/personaContent.ts`）

API 中 6 类回复内容按人格路由：

| 场景 | confucius | laozi | zen |
|------|-----------|-------|-----|
| 演示输出（无 Key） | 儒式白话翻译腔 | 道家风范 | 禅宗机锋 |
| 安全拦截 | 礼法框架 | 天道框架 | 本心框架 |
| 网络审计 | 礼法 | 天道 | 禅心 |
| 威胁评价 | 名分 | 柔弱之势 | 觉照 |
| 人身攻击回退 | 名分与体面 | 和气 | 本来面目 |
| 作品自谦回退 | 本分与体面 | 道与自然 | 随缘与机锋 |

### 装饰元素差异化

每个人格 Hero 区的装饰元素（双轨道字符、侧边注）位置和角度不同：

- 孔子：轨道靠内，侧注靠近中心
- 老子：轨道下移、角度加大，侧注外移
- 禅宗：轨道/侧注位置独立调整

### 频率限制

- 内存 `Map<string, RateRecord>`
- 每 IP+ClientID：12 次 / 10 分钟，60 次 / 天

### 结果清洗

AI 返回后执行：去除伪造引用 → 去除 Markdown 标记 → 去除禁用结尾 → 修正第一人称视角错误

---

## 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev -- --webpack` | 开发服务器（Windows 需 webpack 而非 Turbopack） |
| `npm run build` | 构建 |
| `npm start` | 生产模式启动 |
| `npm test` | 单元测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run deploy` | 部署到 Cloudflare Workers |
| `npm run preview` | 本地 Cloudflare Workers 预览 |
| `npm run public:audit` | 发布前密钥扫描 |
| `node scripts/run-zhouli-batch.mjs` | 批量回归测试 |

---

## Development History

### v0.1.0 — 项目初始化
- 创建项目仓库和 AI 开发文档体系

### v0.2.0 — 更换人物功能
- Header 右侧新增"更换人物"下拉菜单
- 四角色（孔子/老子/清谈/禅宗）CSS 变量覆盖

### v0.2.1 — 人物前端模板独立化
- 将单体 SPA 重构为 `personas/` 目录 + 动态加载容器
- 孔子完整迁移，其余角色先以占位模板填充
- 修复 Hydration 不匹配问题

### v0.3.0 — 老子角色完整实现
- 1355 行完整组件，黛绿色系，道家风格全部文案
- 道帖 Canvas 卡片、绿色主题装饰
- 修复中文引号嵌套 SWC 解析失败等 4 个 Bug

### v0.3.1 — 禅宗角色完整实现 + 清谈移除
- 1337 行完整组件，枯墨灰色系，禅宗风格
- 技能包独立化：三人格拥有独立的 SKILL.md 和 ZIP
- 缘起内容差异化（不再复用孔子文案）
- 移除清谈角色，人物排序改为：孔子 → 禅宗 → 老子

### v0.4.0 — 人格回复内容差异化
- 创建 `lib/personaContent.ts`，统一管理三套人格回复文案
- API 6 类回复（demo/安全/审计/威胁评价/人身攻击/自谦回退）按 persona 路由
- 前端 payload 增加 `persona` 字段

### v0.4.1 — SKILL.md 作为 System Prompt + UI 完善
- 重构 `lib/prompt.ts`：运行时读 SKILL.md 作为 system prompt
- 三条消息精简为两条（System=SKILL.md 原文，User=拼接指示）
- 禅宗 UI 模式短语改为"截断妄见/看脚下路/吾心明月/当下即是"
- 替换老子/禅宗图片、修复 hydration 错误

### v0.4.2 — 图片替换与下载卡片优化
- 替换老子项目照片、修复浏览器缓存问题
- 下载卡片文件名前缀统一改为"儒释道"

---

## 添加新角色指南

参见 `ai-docs/template-rules.md` 详细记录。

### 需改动的文件

| # | 文件 | 操作 |
|---|------|------|
| 1 | `personas/<id>/index.tsx` | 新建完整组件（~1350 行，仿现有结构） |
| 2 | `app/globals.css` | 追加 `[data-persona="<id>"]` CSS 变量 + 硬编码颜色覆盖 |
| 3 | `app/page.tsx` | import + 组件注册 |
| 4 | `personas/types.ts` | 在 Persona 联合类型中添加新 ID |
| 5 | `personas/confucius/index.tsx` | personas 数组添加新角色 |
| 6 | `personas/laozi/index.tsx` | personas 数组添加新角色 |
| 7 | `personas/zen/index.tsx` | personas 数组添加新角色 |
| 8 | `lib/personaContent.ts` | 实现 6 组回复函数 + dispatch 扩展 |
| 9 | `public/images/<id>-assembly.*` | 角色专属图片 |
| 10 | `skill-package/speak-<id>/` | 独立 SKILL.md + agents/openai.yaml |
| 11 | `public/downloads/` | 独立 SKILL.md + ZIP |

### 色系参考

| 角色 | 建议色系 | 核心概念 |
|------|----------|----------|
| 孔子 | 朱红 | 礼 |
| 老子 | 黛绿 | 道 |
| 禅宗 | 枯墨灰 | 禅 |
| 未来角色 | 自定义 | 自定义 |

---

## 设计原则

1. **单页架构**：每人格全部 UI 在单个 `"use client"` 组件中
2. **无外部 UI 依赖**：纯手写 CSS（古代中国美学：宣纸/墨/朱砂色系，宋体字）+ 内联 SVG 图标
3. **Canvas 图片生成**：手工绘制卡片，无 html2canvas
4. **人格隔离**：提示词、回复文案、UI 文字、色系完全独立，禁止串用
5. **版本记录**：每次 AI 相关改动后，在 `ai-docs/changelogs/` 下新建版本文件

---

## Deployment

### Cloudflare Workers

```bash
npm install
npx wrangler login
npx wrangler secret put DEEPSEEK_API_KEY
npm run deploy
```

### Vercel

1. 导入仓库到 Vercel
2. 添加 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`MAX_OUTPUT_TOKENS`
3. 部署

### 自托管

```bash
npm run build
npm start
```

生产环境多实例部署时，应将内存频率限制替换为 Redis / Upstash / D1 / KV。

---

## Security Notes

- 永不提交真实 API Key 或平台令牌
- 私有请求日志和批量输出保留在 Git 之外
- 高流量公开部署前配置共享频率限制和计费告警
- 发布前运行 `npm run public:audit`

---



## License

MIT License. See [LICENSE](LICENSE).
