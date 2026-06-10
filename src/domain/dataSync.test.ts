import { describe, expect, it } from "vitest";
import { summarizeDataReliability, summarizeDataSync } from "./dataSync";

describe("summarizeDataSync", () => {
  it("describes a pending sync as waiting for market data", () => {
    expect(
      summarizeDataSync({
        state: "pending",
        source: "AKShare",
        detail: "等待同步行情、K线、财务和公告",
      }),
    ).toEqual({
      label: "待同步",
      tone: "pending",
      detail: "等待同步行情、K线、财务和公告",
      meta: "AKShare",
    });
  });

  it("includes source and time for a synced snapshot", () => {
    expect(
      summarizeDataSync({
        state: "synced",
        source: "AKShare",
        lastSyncedAt: "2026-06-09 09:35",
        detail: "行情和日 K 已更新",
      }),
    ).toEqual({
      label: "已同步",
      tone: "synced",
      detail: "行情和日 K 已更新",
      meta: "AKShare · 2026-06-09 09:35",
    });
  });

  it("keeps the failure reason visible", () => {
    expect(
      summarizeDataSync({
        state: "failed",
        source: "AKShare",
        detail: "行情接口超时",
      }),
    ).toEqual({
      label: "同步失败",
      tone: "failed",
      detail: "行情接口超时",
      meta: "AKShare",
    });
  });

  it("summarizes provider attempts for auto sync diagnostics", () => {
    expect(
      summarizeDataSync({
        state: "failed",
        source: "auto",
        detail: "所有免费数据源均同步失败",
        attempts: [
          { source: "AKShare", state: "failed", detail: "东方财富接口超时" },
          { source: "BaoStock", state: "failed", detail: "BaoStock 登录失败" },
        ],
      }),
    ).toEqual({
      label: "同步失败",
      tone: "failed",
      detail: "所有免费数据源均同步失败",
      meta: "auto · 尝试 AKShare、BaoStock",
    });
  });
});

describe("summarizeDataReliability", () => {
  it("marks a normal synced snapshot as reliable real data", () => {
    expect(
      summarizeDataReliability({
        state: "synced",
        source: "AKShare",
        lastSyncedAt: "2026-06-10 09:35",
        detail: "行情、日线、周线、60 分钟线已更新",
      }),
    ).toEqual({
      label: "真实同步",
      tone: "synced",
      evidence: "AKShare · 2026-06-10 09:35",
      guidance: "可用于当前分析，仍需结合人工复核和仓位纪律。",
    });
  });

  it("marks a cached snapshot as a fallback that needs review", () => {
    expect(
      summarizeDataReliability({
        state: "synced",
        source: "cache",
        detail: "真实数据源本次同步失败，暂用最近一次可信快照",
      }),
    ).toEqual({
      label: "缓存回退",
      tone: "sample",
      evidence: "最近一次可信快照",
      guidance: "可参考结构和位置，但不能当作最新盘中行情，需要下次同步确认。",
    });
  });

  it("marks a failed snapshot as unusable for operation decisions", () => {
    expect(
      summarizeDataReliability({
        state: "failed",
        source: "auto",
        detail: "所有免费数据源均同步失败",
      }),
    ).toEqual({
      label: "数据不可用",
      tone: "failed",
      evidence: "auto",
      guidance: "不能生成买卖动作，只能进入人工排查和重新同步。",
    });
  });
});
