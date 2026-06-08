import { describe, expect, it } from "vitest";
import { deriveDecision } from "./decision";

describe("decision domain", () => {
  it("returns data insufficient before any opportunity label", () => {
    expect(
      deriveDecision({
        dataHealth: "missing",
        riskFlags: [],
        trend: "up",
        structureSignal: "second_buy_candidate",
      }),
    ).toMatchObject({
      label: "数据不足，暂不下结论",
      tone: "neutral",
    });
  });

  it("uses risk review when a risk flag is present", () => {
    expect(
      deriveDecision({
        dataHealth: "ready",
        riskFlags: ["跌破中期防守位"],
        trend: "up",
        structureSignal: "second_buy_confirmed",
      }),
    ).toMatchObject({
      label: "风险复盘",
      tone: "risk",
    });
  });

  it("allows small pilot when data is ready and a second buy is confirmed", () => {
    expect(
      deriveDecision({
        dataHealth: "ready",
        riskFlags: [],
        trend: "up",
        structureSignal: "second_buy_confirmed",
      }),
    ).toMatchObject({
      label: "可小仓试探",
      tone: "opportunity",
    });
  });

  it("waits when the structure is only a candidate", () => {
    expect(
      deriveDecision({
        dataHealth: "ready",
        riskFlags: [],
        trend: "range",
        structureSignal: "second_buy_candidate",
      }),
    ).toMatchObject({
      label: "等待二买确认",
      tone: "wait",
    });
  });
});
