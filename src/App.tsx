import { deriveDecision } from "./domain/decision";
import { seedFamilyPool } from "./data/seedFamilyPool";

const statusLabels = {
  holding: "已持有",
  watching: "观察中",
  researching: "准备研究",
  paused: "暂停跟踪",
} as const;

export function App() {
  const selected = seedFamilyPool[0];
  const decision = deriveDecision(selected.decisionInput);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">A 股优先 · 家庭股票池</p>
          <h1>家庭股票池投研系统</h1>
          <p>
            输入家庭关注股票，系统同步真实数据，并用可解释框架生成结论、风险提醒和下一步动作。
          </p>
        </div>
        <div className="summary-card">
          <span>当前股票池</span>
          <strong>{seedFamilyPool.length} 只</strong>
          <small>Phase 1：本地种子数据</small>
        </div>
      </header>

      <section className="workspace">
        <section className="panel family-pool">
          <div className="section-title">
            <h2>家庭股票池</h2>
            <span>状态 + 标签 + 当前结论</span>
          </div>
          <div className="stock-list">
            {seedFamilyPool.map((stock) => {
              const stockDecision = deriveDecision(stock.decisionInput);
              return (
                <article className="stock-card" key={stock.ticker}>
                  <div>
                    <h3>{stock.name}</h3>
                    <span>{stock.ticker}</span>
                  </div>
                  <strong>{statusLabels[stock.status]}</strong>
                  <p>{stockDecision.label}</p>
                  <div className="tag-row">
                    {stock.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel analysis-panel">
          <div className="section-title">
            <h2>{selected.name}</h2>
            <span>{selected.ticker}</span>
          </div>

          <div className={`decision-card tone-${decision.tone}`}>
            <span>当前结论</span>
            <strong>{decision.label}</strong>
            <p>{decision.reason}</p>
          </div>

          <div className="metric-grid">
            <div>
              <span>现价</span>
              <strong>{selected.price.toFixed(2)}</strong>
            </div>
            <div>
              <span>数据健康</span>
              <strong>{selected.dataHealthLabel}</strong>
            </div>
            <div>
              <span>下一步动作</span>
              <strong>进入人工复核，确认仓位和失效位</strong>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
