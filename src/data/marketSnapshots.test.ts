import { describe, expect, it } from "vitest";
import { applyMarketSnapshots, type MarketSnapshot } from "./marketSnapshots";
import { seedFamilyPool } from "./seedFamilyPool";

describe("applyMarketSnapshots", () => {
  it("overlays a synced market snapshot onto a family pool stock", () => {
    const snapshots: MarketSnapshot[] = [
      {
        ticker: "688041",
        name: "海光信息",
        price: 281.12,
        dataHealthLabel: "行情和日 K 已更新",
        decisionInput: {
          dataHealth: "ready",
          riskFlags: [],
          trend: "up",
          structureSignal: "second_buy_candidate",
        },
        structureAnalysis: {
          buyPointLabel: "二买候选",
          centerRange: { high: 282, low: 260 },
          dataHealth: "ready",
          decisionInput: {
            dataHealth: "ready",
            riskFlags: [],
            trend: "up",
            structureSignal: "second_buy_candidate",
          },
          keyLevels: {
            resistance: 286,
            risk: 252,
            support: 260,
          },
          levelSummary: {
            daily: "日线回到中枢上沿",
            hourly60: "60 分钟回踩未破",
            weekly: "周线仍保持修复",
          },
          riskFlags: [],
          sellPointLabel: "无风险卖点",
          structureSignal: "second_buy_candidate",
          summary: "日线结构改善，等待二买确认。",
          trend: "up",
        },
        dataSync: {
          state: "synced",
          source: "AKShare",
          lastSyncedAt: "2026-06-09 09:35",
          detail: "行情和日 K 已更新",
        },
      },
    ];

    const [stock] = applyMarketSnapshots(seedFamilyPool, snapshots);

    expect(stock.price).toBe(281.12);
    expect(stock.dataHealthLabel).toBe("行情和日 K 已更新");
    expect(stock.decisionInput.structureSignal).toBe("second_buy_candidate");
    expect(stock.structureAnalysis?.buyPointLabel).toBe("二买候选");
    expect(stock.structureAnalysis?.centerRange).toEqual({ high: 282, low: 260 });
    expect(stock.dataSync).toEqual({
      state: "synced",
      source: "AKShare",
      lastSyncedAt: "2026-06-09 09:35",
      detail: "行情和日 K 已更新",
    });
  });

  it("keeps the original stock when no snapshot is available", () => {
    const [stock] = applyMarketSnapshots(seedFamilyPool, []);

    expect(stock.price).toBe(seedFamilyPool[0].price);
    expect(stock.dataSync.state).toBe("sample");
  });
});
