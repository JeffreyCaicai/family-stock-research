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
