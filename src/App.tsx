import { FormEvent, useEffect, useMemo, useState } from "react";
import { summarizeDataReliability, summarizeDataSync } from "./domain/dataSync";
import { deriveDecision } from "./domain/decision";
import type { FamilyPoolStatus } from "./domain/familyPool";
import { deriveOperationPlan } from "./domain/operationPlan";
import {
  createFamilyPoolItem,
  type FamilyPoolItem,
  mergeFamilyPoolItems,
  normalizeTicker,
} from "./domain/familyPool";
import {
  loadFamilyPoolFromApi,
  refreshMarketSnapshotFromApi,
  saveFamilyPoolToApi,
} from "./data/familyPoolApi";
import { loadFamilyPoolItems, saveFamilyPoolItems } from "./data/familyPoolRepository";
import { applyMarketSnapshots } from "./data/marketSnapshots";
import { seedFamilyPool, type SeedStock } from "./data/seedFamilyPool";
import type { StructureRange } from "./domain/technicalStructure";

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadFamilyPoolFromApi().then((apiItems) => {
      if (cancelled || !apiItems) {
        return;
      }

      const next = hydrateFamilyPool(apiItems);
      setFamilyPool(next);
      saveFamilyPoolItems(next);
      setSelectedTicker((current) =>
        current && next.some((stock) => stock.ticker === current) ? current : (next[0]?.ticker ?? null),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const mergedPool = useMemo(
    () =>
      mergeFamilyPoolItems(familyPool).map((item) => {
        const fullItem = familyPool.find((stock) => stock.ticker === item.ticker);
        return fullItem ?? makePendingStock(item.ticker, item.status, item.tags);
      }),
    [familyPool],
  );
  const selected =
    mergedPool.find((stock) => stock.ticker === selectedTicker) ?? mergedPool[0] ?? familyPool[0];
  const decision = deriveDecision(selected.decisionInput);
  const selectedSync = summarizeDataSync(selected.dataSync);
  const selectedReliability = summarizeDataReliability(selected.dataSync);
  const selectedStructure = selected.structureAnalysis;
  const operationPlan = deriveOperationPlan({
    decision,
    price: selected.price,
    status: selected.status,
    structure: selectedStructure,
  });

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
      setSelectedTicker(ticker);
      setTickerInput("");
      setStatusInput("watching");
      setTagsInput("");
    } catch {
      setFormError("请输入 6 位 A 股代码，例如 600519。");
    }
  }

  async function handleRefreshAnalysis() {
    if (!selected || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshError("");
    const snapshots = await refreshMarketSnapshotFromApi(selected.ticker);
    setIsRefreshing(false);

    if (!snapshots || snapshots.length === 0) {
      setRefreshError("本地同步服务暂不可用，请确认 API 已启动。");
      return;
    }

    setFamilyPool((current) => {
      const next = applyMarketSnapshots(current, snapshots);
      saveFamilyPoolItems(next);
      return next;
    });
    setSelectedTicker(selected.ticker);
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
                <button
                  aria-label={`选择 ${stock.name} ${stock.ticker}`}
                  className={`stock-card ${stock.ticker === selected.ticker ? "is-selected" : ""}`}
                  key={stock.ticker}
                  onClick={() => setSelectedTicker(stock.ticker)}
                  type="button"
                >
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
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel analysis-panel">
          <div className="section-title">
            <h2>{selected.name}</h2>
            <div className="section-actions">
              <span>{selected.ticker}</span>
              <button disabled={isRefreshing} onClick={handleRefreshAnalysis} type="button">
                {isRefreshing ? "刷新中" : "刷新分析"}
              </button>
            </div>
          </div>
          {refreshError ? <p className="form-error">{refreshError}</p> : null}

          <div className={`decision-card tone-${decision.tone}`}>
            <span>当前结论</span>
            <strong>{decision.label}</strong>
            <p>{decision.reason}</p>
          </div>

          <div className={`reliability-card tone-${selectedReliability.tone}`}>
            <span>行情依据</span>
            <strong>{selectedReliability.label}</strong>
            <small>{selectedReliability.evidence}</small>
            <p>{selectedReliability.guidance}</p>
          </div>

          <div className="metric-grid">
            <div>
              <span>现价</span>
              <strong>{formatPrice(selected.price)}</strong>
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

          <section className="structure-panel">
            <div className="section-title compact">
              <h2>结构分析层</h2>
              <span>周线 · 日线 · 60 分钟</span>
            </div>
            <div className="structure-grid">
              <div>
                <span>买点观察</span>
                <strong>{selectedStructure?.buyPointLabel ?? "无买点"}</strong>
                <small>{selectedStructure?.levelSummary.hourly60 ?? "等待 60 分钟 K 线同步"}</small>
              </div>
              <div>
                <span>中枢区间</span>
                <strong>{formatCenterRange(selectedStructure?.centerRange)}</strong>
                <small>{selectedStructure?.levelSummary.daily ?? "等待日线结构计算"}</small>
              </div>
              <div>
                <span>风险卖点</span>
                <strong>{selectedStructure?.sellPointLabel ?? "待计算"}</strong>
                <small>
                  {selectedStructure?.riskFlags[0] ??
                    selectedStructure?.levelSummary.weekly ??
                    "等待周线结构计算"}
                </small>
              </div>
            </div>
            <p className="structure-summary">
              {selectedStructure?.summary ?? "结构数据尚未完整，先同步日线、周线和 60 分钟线。"}
            </p>
          </section>

          <section className="operation-panel">
            <div className="section-title compact">
              <h2>家庭操作建议</h2>
              <span>动作 · 条件 · 纪律</span>
            </div>
            <div className={`operation-action tone-${operationPlan.tone}`}>
              <span>当前动作</span>
              <strong>{operationPlan.primaryAction}</strong>
            </div>
            <div className="operation-grid">
              <div>
                <span>触发条件</span>
                <p>{operationPlan.trigger}</p>
              </div>
              <div>
                <span>失效条件</span>
                <p>{operationPlan.invalidation}</p>
              </div>
              <div>
                <span>仓位纪律</span>
                <p>{operationPlan.positionRule}</p>
              </div>
            </div>
            <ul className="operation-checklist">
              {operationPlan.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
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

function formatCenterRange(range: StructureRange | undefined): string {
  if (!range) {
    return "待计算";
  }
  return `${range.low} - ${range.high}`;
}

function formatPrice(price: number): string {
  return price > 0 ? price.toFixed(2) : "待同步";
}
