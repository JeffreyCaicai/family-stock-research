import { describe, expect, it } from "vitest";
import { deriveTechnicalStructure, type KLineBar } from "./technicalStructure";

function bars(closes: number[]): KLineBar[] {
  return closes.map((close, index) => ({
    date: `2026-05-${String(index + 1).padStart(2, "0")}`,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000 + index,
  }));
}

describe("technical structure domain", () => {
  it("marks data as missing when K line coverage is not enough", () => {
    const result = deriveTechnicalStructure({
      daily: bars([10, 11, 12]),
      weekly: [],
      hourly60: [],
    });

    expect(result.dataHealth).toBe("missing");
    expect(result.decisionInput).toMatchObject({
      dataHealth: "missing",
      structureSignal: "none",
    });
    expect(result.summary).toContain("K 线不足");
  });

  it("detects a second-buy candidate when daily structure improves and 60 minute line confirms", () => {
    const result = deriveTechnicalStructure({
      daily: bars([
        20, 21, 22, 23, 24, 25, 26, 25, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
        35, 36, 37, 38, 39,
      ]),
      weekly: bars([18, 19, 20, 22, 24, 26, 28, 30]),
      hourly60: bars([
        28, 29, 30, 31, 32, 31, 30, 31, 32, 33, 34, 35, 36, 35, 36, 37, 38, 39, 40,
        41,
      ]),
    });

    expect(result.dataHealth).toBe("ready");
    expect(result.trend).toBe("up");
    expect(result.structureSignal).toBe("second_buy_candidate");
    expect(result.centerRange).toEqual({
      high: expect.any(Number),
      low: expect.any(Number),
    });
    expect(result.buyPointLabel).toBe("二买候选");
    expect(result.decisionInput).toMatchObject({
      dataHealth: "ready",
      riskFlags: [],
      trend: "up",
      structureSignal: "second_buy_candidate",
    });
  });

  it("prioritizes risk sell candidates when price breaks recent defense", () => {
    const result = deriveTechnicalStructure({
      daily: bars([
        50, 51, 52, 53, 54, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42,
        37, 35, 33,
      ]),
      weekly: bars([45, 46, 47, 48, 47, 45, 43, 40]),
      hourly60: bars([
        44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26,
        25,
      ]),
    });

    expect(result.structureSignal).toBe("risk_sell_candidate");
    expect(result.sellPointLabel).toBe("风险卖点候选");
    expect(result.decisionInput.riskFlags).toContain("跌破近期结构防守位");
  });
});
