export type DataHealth = "ready" | "partial" | "missing";
export type Trend = "up" | "range" | "down";
export type StructureSignal =
  | "none"
  | "second_buy_candidate"
  | "second_buy_confirmed"
  | "risk_sell_candidate";

export type DecisionTone = "neutral" | "risk" | "wait" | "hold" | "opportunity";

export type DecisionInput = {
  dataHealth: DataHealth;
  riskFlags: string[];
  trend: Trend;
  structureSignal: StructureSignal;
};

export type Decision = {
  label:
    | "数据不足，暂不下结论"
    | "风险复盘"
    | "只观察不加仓"
    | "可继续持有"
    | "等待二买确认"
    | "可小仓试探";
  tone: DecisionTone;
  reason: string;
};

export function deriveDecision(input: DecisionInput): Decision {
  if (input.dataHealth !== "ready") {
    return {
      label: "数据不足，暂不下结论",
      tone: "neutral",
      reason: "关键数据尚未完整，先补齐行情、K线和结构数据。",
    };
  }

  if (input.riskFlags.length > 0 || input.structureSignal === "risk_sell_candidate") {
    return {
      label: "风险复盘",
      tone: "risk",
      reason: input.riskFlags[0] ?? "出现风险卖点候选，先复盘风险是否扩大。",
    };
  }

  if (input.structureSignal === "second_buy_confirmed" && input.trend === "up") {
    return {
      label: "可小仓试探",
      tone: "opportunity",
      reason: "数据健康，趋势向上，二买结构已确认，可进入小仓试探复核。",
    };
  }

  if (input.structureSignal === "second_buy_candidate") {
    return {
      label: "等待二买确认",
      tone: "wait",
      reason: "已有二买候选，但小级别确认仍不足。",
    };
  }

  if (input.trend === "up") {
    return {
      label: "可继续持有",
      tone: "hold",
      reason: "趋势未破坏，暂无高优先级风险。",
    };
  }

  return {
    label: "只观察不加仓",
    tone: "wait",
    reason: "结构和赔率尚未形成明确机会。",
  };
}
