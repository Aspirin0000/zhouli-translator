# 匿名统计

官网和 B 站 Toy 共用线上 Worker 与 `ANALYTICS_DB` D1 绑定。默认不保存生成输入或输出，只有用户主动授权提交匿名案例时，才会写入 `submitted_cases`。

## 配置

先执行 migration，再配置 Worker Secret `RESPONSE_FEEDBACK_SECRET`。生产环境才打开：

```text
ANALYTICS_ENABLED=true
FEEDBACK_UI_ENABLED=true
CASE_SUBMISSION_ENABLED=true
AB_TEST_ENABLED=true
AB_TEST_B_PERCENT=50
PROMPT_VERSION_A=zhouli-v1
PROMPT_VERSION_B=zhouli-v3
```

A/B 实验只改变提示词版本。关闭实验时把 `AB_TEST_ENABLED` 设为 `false`，所有请求将回到 A 版 `zhouli-v1`。

当前生产实验为 50/50：同一客户端的本地分桶小于 50 时使用 B 版 `zhouli-v3`，其余使用 A 版 `zhouli-v1`。官网与 B站 Toy 分别分桶，不做跨端身份关联。旧的 `zhouli-v2` 提示词已退役；D1 中已有的 `zhouli-v2` 行仅作为历史实验记录保留，不应与 `zhouli-v3` 合并统计。查询时按问礼、释礼和客户端分别查看，不能把不同方向的反馈率混在一起。旧的 `incomplete_result` 与新的 `incomplete_*` 都表示生成完整性失败；新记录会进一步区分长度截断、空结果、过短和句尾未收束。

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
