import { describe, expect, it } from "vitest";
import { deriveDecision } from "./decision";
import { deriveOperationPlan } from "./operationPlan";
import type { TechnicalStructureAnalysis } from "./technicalStructure";

const readyStructure: TechnicalStructureAnalysis = {
  buyPointLabel: "二买确认",
  centerRange: { high: 282, low: 250 },
  dataHealth: "ready",
  decisionInput: {
    dataHealth: "ready",
    riskFlags: [],
    trend: "up",
    structureSignal: "second_buy_confirmed",
  },
  keyLevels: {
    resistance: 286,
    risk: 245,
    support: 250,
  },
  levelSummary: {
    daily: "日线站上中枢上沿",
    hourly60: "60 分钟站上短均线",
    weekly: "周线保持修复",
  },
  riskFlags: [],
  sellPointLabel: "无风险卖点",
  structureSignal: "second_buy_confirmed",
  summary: "二买结构进入确认观察。",
  trend: "up",
};

describe("operation plan domain", () => {
  it("asks to complete data before giving an operation plan", () => {
    const plan = deriveOperationPlan({
      decision: deriveDecision({
        dataHealth: "missing",
        riskFlags: [],
        trend: "range",
        structureSignal: "none",
      }),
      price: 0,
      status: "watching",
    });

    expect(plan.primaryAction).toBe("先补齐数据");
    expect(plan.trigger).toContain("同步");
    expect(plan.checklist).toContain("先运行行情同步，补齐日线、周线和 60 分钟线");
  });

  it("turns a confirmed second-buy into a small pilot plan with invalidation level", () => {
    const plan = deriveOperationPlan({
      decision: deriveDecision(readyStructure.decisionInput),
      price: 274.06,
      status: "holding",
      structure: readyStructure,
    });

    expect(plan.primaryAction).toBe("可小仓试探");
    expect(plan.positionRule).toContain("试探仓");
    expect(plan.trigger).toContain("286");
    expect(plan.invalidation).toContain("245");
    expect(plan.checklist).toContain("只在触发条件满足后行动，不提前把候选信号当成确认信号");
  });

  it("turns risk sell candidates into a reduction review for held stocks", () => {
    const riskStructure: TechnicalStructureAnalysis = {
      ...readyStructure,
      buyPointLabel: "无买点",
      decisionInput: {
        dataHealth: "ready",
        riskFlags: ["跌破近期结构防守位"],
        trend: "down",
        structureSignal: "risk_sell_candidate",
      },
      riskFlags: ["跌破近期结构防守位"],
      sellPointLabel: "风险卖点候选",
      structureSignal: "risk_sell_candidate",
      trend: "down",
    };

    const plan = deriveOperationPlan({
      decision: deriveDecision(riskStructure.decisionInput),
      price: 230,
      status: "holding",
      structure: riskStructure,
    });

    expect(plan.primaryAction).toBe("减仓观察");
    expect(plan.positionRule).toContain("先保护本金");
    expect(plan.invalidation).toContain("风险卖点");
  });
});
