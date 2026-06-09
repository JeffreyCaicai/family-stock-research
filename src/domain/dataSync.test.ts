import { describe, expect, it } from "vitest";
import { summarizeDataSync } from "./dataSync";

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
