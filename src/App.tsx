import { FormEvent, useMemo, useState } from "react";
import { summarizeDataSync } from "./domain/dataSync";
import { deriveDecision } from "./domain/decision";
import type { FamilyPoolStatus } from "./domain/familyPool";
import {
  createFamilyPoolItem,
  type FamilyPoolItem,
  mergeFamilyPoolItems,
  normalizeTicker,
} from "./domain/familyPool";
import { saveFamilyPoolToApi } from "./data/familyPoolApi";
import { loadFamilyPoolItems, saveFamilyPoolItems } from "./data/familyPoolRepository";
import { applyMarketSnapshots } from "./data/marketSnapshots";
import { seedFamilyPool, type SeedStock } from "./data/seedFamilyPool";

const statusLabels: Record<FamilyPoolStatus, string> = {
  holding: "已持有",
  watching: "观察中",
  researching: "准备研究",
  paused: "暂停跟踪",
};

const statusOptions: Array<{ value: FamilyPoolStatus; label: string }> = [
  { value: "holding", label: "已持有" },
  { value: "watching", label: "观察中" },
  { value: "researching", label: "准备研究" },
  { value: "paused", label: "暂停跟踪" },
];

const syncedSeedFamilyPool = applyMarketSnapshots(seedFamilyPool);

export function App() {
  const [familyPool, setFamilyPool] = useState<SeedStock[]>(() =>
    hydrateFamilyPool(loadFamilyPoolItems()),
  );
  const [tickerInput, setTickerInput] = useState("");
  const [statusInput, setStatusInput] = useState<FamilyPoolStatus>("watching");
  const [tagsInput, setTagsInput] = useState("");
  const [formError, setFormError] = useState("");

  const selected = familyPool[0];
  const decision = deriveDecision(selected.decisionInput);
  const selectedSync = summarizeDataSync(selected.dataSync);
  const mergedPool = useMemo(
    () =>
      mergeFamilyPoolItems(familyPool).map((item) => {
        const fullItem = familyPool.find((stock) => stock.ticker === item.ticker);
        return fullItem ?? makePendingStock(item.ticker, item.status, item.tags);
      }),
    [familyPool],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    try {
      const ticker = normalizeTicker(tickerInput);
      const tags = splitTags(tagsInput);
      const pending = makePendingStock(ticker, statusInput, tags);
      setFamilyPool((current) => {
        const next = mergeFamilyPoolItems([...current, pending]).map((item) =>
          toDisplayStock(item, current),
        );
        saveFamilyPoolItems(next);
        void saveFamilyPoolToApi(next);
        return next;
      });
      setTickerInput("");
      setStatusInput("watching");
      setTagsInput("");
    } catch {
      setFormError("请输入 6 位 A 股代码，例如 600519。");
    }
  }

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
          <strong>{familyPool.length} 只</strong>
          <small>Phase 1：本地持久化</small>
        </div>
      </header>

      <section className="input-panel panel">
        <div className="section-title">
          <h2>加入股票</h2>
          <span>先录入代码，后续同步真实数据</span>
        </div>
        <form className="pool-form" onSubmit={handleSubmit}>
          <label htmlFor="ticker-input">
            股票代码
            <input
              id="ticker-input"
              placeholder="600519"
              value={tickerInput}
              onChange={(event) => setTickerInput(event.target.value)}
            />
          </label>
          <label htmlFor="status-input">
            状态
            <select
              aria-label="状态"
              id="status-input"
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value as FamilyPoolStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="tags-input">
            标签
            <input
              id="tags-input"
              placeholder="红利, 爸爸关注"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
          </label>
          <button type="submit">加入家庭股票池</button>
        </form>
        {formError ? <p className="form-error">{formError}</p> : null}
      </section>

      <section className="workspace">
        <section className="panel family-pool">
          <div className="section-title">
            <h2>家庭股票池</h2>
            <span>状态 + 标签 + 当前结论</span>
          </div>
          <div className="stock-list">
            {mergedPool.map((stock) => {
              const stockDecision = deriveDecision(stock.decisionInput);
              const syncSummary = summarizeDataSync(stock.dataSync);
              return (
                <article className="stock-card" key={stock.ticker}>
                  <div>
                    <h3>{stock.name}</h3>
                    <span>{stock.ticker}</span>
                  </div>
                  <strong>{statusLabels[stock.status]}</strong>
                  <div className={`sync-status tone-${syncSummary.tone}`}>
                    <span>同步状态</span>
                    <strong>{syncSummary.label}</strong>
                    <small>{syncSummary.meta}</small>
                  </div>
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
              <span>同步状态</span>
              <strong>{selectedSync.label}</strong>
              <small>{selectedSync.detail}</small>
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

function splitTags(input: string): string[] {
  return input
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function makePendingStock(
  ticker: string,
  status: FamilyPoolStatus,
  tags: string[],
): SeedStock {
  return {
    ...createFamilyPoolItem(ticker, { status, tags }),
    name: `${ticker} 待同步`,
    price: 0,
    dataHealthLabel: "仅已录入代码，等待同步行情、K线和结构数据",
    dataSync: {
      state: "pending",
      source: "AKShare",
      detail: "等待同步行情、K线、财务和公告",
    },
    decisionInput: {
      dataHealth: "missing",
      riskFlags: [],
      trend: "range",
      structureSignal: "none",
    },
  };
}

function hydrateFamilyPool(savedItems: FamilyPoolItem[]): SeedStock[] {
  return mergeFamilyPoolItems([...savedItems, ...syncedSeedFamilyPool]).map((item) =>
    toDisplayStock(item, syncedSeedFamilyPool),
  );
}

function toDisplayStock(item: FamilyPoolItem, source: SeedStock[]): SeedStock {
  const sourceMatch = source.find((stock) => stock.ticker === item.ticker);
  if (sourceMatch) {
    return {
      ...sourceMatch,
      status: item.status,
      tags: item.tags,
    };
  }
  return makePendingStock(item.ticker, item.status, item.tags);
}
