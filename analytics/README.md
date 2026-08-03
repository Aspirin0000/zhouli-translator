# 匿名统计

官网和 B 站 Toy 共用线上 Worker 与 `ANALYTICS_DB` D1 绑定。默认不保存生成输入或输出，只有用户主动授权提交匿名案例时，才会写入 `submitted_cases`。

## 配置

先执行 migration，再配置 Worker Secret `RESPONSE_FEEDBACK_SECRET`。生产环境才打开：

```text
ANALYTICS_ENABLED=true
FEEDBACK_UI_ENABLED=true
CASE_SUBMISSION_ENABLED=true
AB_TEST_ENABLED=false
AB_TEST_B_PERCENT=50
PROMPT_VERSION_A=zhouli-v1
PROMPT_VERSION_B=zhouli-v4
```

A/B 实验只改变提示词版本。关闭实验时把 `AB_TEST_ENABLED` 设为 `false`，A 版本仍保留为当前线上提示词。

实验配置保留为 50/50，但当前已关闭，所有请求使用 `zhouli-v1`。启用后，Worker 会为每次生成独立随机分配 `zhouli-v1` 或 `zhouli-v4`；客户端不能指定或固定实验桶。同一浏览器的连续请求可能进入不同版本，这是本轮实验的预期行为。

`zhouli-v2` 与 `zhouli-v3` 的历史记录只作为旧实验数据保留，分析时不得与 `zhouli-v4` 合并。查询时还应按问礼、释礼和客户端分别查看，不能把不同方向的反馈率混在一起。旧的 `incomplete_result` 与新的 `incomplete_*` 都表示生成完整性失败；新记录会进一步区分长度截断、空结果、过短和句尾未收束。

## 查询

```bash
npx wrangler d1 execute zhouli-analytics --remote --file analytics/queries/surface-comparison.sql
npx wrangler d1 execute zhouli-analytics --remote --file analytics/queries/ab-comparison.sql
npx wrangler d1 execute zhouli-analytics --remote --file analytics/queries/negative-reasons.sql
npx wrangler d1 execute zhouli-analytics --remote --file analytics/queries/failure-breakdown.sql
```

定期清理 60 天前的案例：

```bash
npm run analytics:cleanup
```

清理命令只删除超过 `delete_after` 的案例，不导出案例内容。
