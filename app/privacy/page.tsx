export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-page-inner">
        <a className="privacy-back" href="./index.html">← 返回合乎周礼</a>
        <p className="eyebrow">礼官署录 · 文案版本 2026-07-27</p>
        <h1>隐私与匿名统计说明</h1>
        <p className="privacy-lead">
          合乎周礼的官网与 B 站 Toy 是同一产品的两个入口。我们只用匿名运行指标判断功能是否正常，默认不把你的输入当作统计样本保存。
        </p>

        <section>
          <h2>默认记录什么</h2>
          <p>
            每次生成会记录随机的结果编号、时间、问礼或释礼方向、客户端端面、客户端版本、发布渠道、提示词版本、实验版本、模型名、成功与否、响应时间、输入输出字数和模型 token 用量。复制、重新生成、正负反馈等操作也会以结果编号记录。
          </p>
        </section>

        <section>
          <h2>默认不记录什么</h2>
          <p>
            默认不保存你的输入原文、生成结果原文、IP 地址、完整 User-Agent、B 站账号、Cookie、设备指纹、精确位置或跨官网与 Toy 关联同一人的标识。统计中的生成次数不等于独立用户数。
          </p>
        </section>

        <section>
          <h2>匿名案例</h2>
          <p>
            只有你主动点选负面反馈后的“提交匿名案例”，并在未勾选的授权框中明确确认，我们才会保存本次输入、生成结果和反馈原因。案例可能被人工查看，只用于改进生成效果；默认不允许公开展示，保存 60 天后自动删除。请勿提交姓名、手机号、住址、聊天隐私或其他敏感信息。
          </p>
        </section>

        <section>
          <h2>用途与删除</h2>
          <p>
            数据只用于判断生成链路质量、比较官网与 Toy 的运行表现、优化提示词和处理安全问题，不用于广告画像，也不做官网与 Toy 的跨端身份关联。需要申请删除已提交案例时，请在 GitHub 仓库提交 Issue，并只提供结果编号，不要再次粘贴隐私内容。
          </p>
        </section>

        <section>
          <h2>联系我们</h2>
          <p>
            项目作者与维护者为原网站作者。反馈入口：
            <a href="https://github.com/Aspirin0000/zhouli-translator/issues" target="_blank" rel="noreferrer">
              GitHub Issues
            </a>
            。本说明更新时间：2026 年 7 月 27 日。
          </p>
        </section>
      </div>
    </main>
  );
}
