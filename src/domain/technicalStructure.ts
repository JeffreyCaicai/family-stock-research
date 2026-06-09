import type { DataHealth, DecisionInput, StructureSignal, Trend } from "./decision";

export type KLineBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type StructureRange = {
  high: number;
  low: number;
};

export type TechnicalStructureAnalysis = {
  buyPointLabel: "无买点" | "二买候选" | "二买确认";
  centerRange?: StructureRange;
  dataHealth: DataHealth;
  decisionInput: DecisionInput;
  keyLevels: {
    resistance?: number;
    risk?: number;
    support?: number;
  };
  levelSummary: {
    daily: string;
    hourly60: string;
    weekly: string;
  };
  riskFlags: string[];
  sellPointLabel: "无风险卖点" | "风险卖点候选";
  structureSignal: StructureSignal;
  summary: string;
  trend: Trend;
};

export type TechnicalStructureInput = {
  daily: KLineBar[];
  weekly: KLineBar[];
  hourly60: KLineBar[];
};

export function deriveTechnicalStructure(input: TechnicalStructureInput): TechnicalStructureAnalysis {
  const dataHealth = deriveDataHealth(input);
  if (dataHealth !== "ready") {
    return {
      buyPointLabel: "无买点",
      dataHealth,
      decisionInput: {
        dataHealth,
        riskFlags: [],
        trend: "range",
        structureSignal: "none",
      },
      keyLevels: {},
      levelSummary: {
        daily: `${input.daily.length} 根日 K`,
        hourly60: `${input.hourly60.length} 根 60 分钟 K`,
        weekly: `${input.weekly.length} 根周 K`,
      },
      riskFlags: [],
      sellPointLabel: "无风险卖点",
      structureSignal: "none",
      summary: "K 线不足，先补齐日线、周线和 60 分钟线后再判断结构。",
      trend: "range",
    };
  }

  const daily = sortedBars(input.daily);
  const weekly = sortedBars(input.weekly);
  const hourly60 = sortedBars(input.hourly60);
  const latestClose = last(daily).close;
  const dailyMa5 = movingAverage(daily, 5);
  const dailyMa20 = movingAverage(daily, 20);
  const hourlyMa10 = movingAverage(hourly60, 10);
  const trend = deriveTrend(latestClose, dailyMa5, dailyMa20);
  const centerRange = deriveCenterRange(daily);
  const support = min(daily.slice(-20).map((bar) => bar.low));
  const resistance = max(daily.slice(-20, -1).map((bar) => bar.high));
  const riskLine = round(support);
  const riskFlags =
    latestClose <= support * 1.03 || (trend === "down" && latestClose < dailyMa20)
      ? ["跌破近期结构防守位"]
      : [];

  const structureSignal = deriveStructureSignal({
    centerRange,
    hourly60,
    hourlyMa10,
    latestClose,
    resistance,
    riskFlags,
    trend,
    weekly,
  });

  const buyPointLabel = buyPointLabelFor(structureSignal);
  const sellPointLabel = structureSignal === "risk_sell_candidate" ? "风险卖点候选" : "无风险卖点";

  return {
    buyPointLabel,
    centerRange,
    dataHealth,
    decisionInput: {
      dataHealth,
      riskFlags,
      trend,
      structureSignal,
    },
    keyLevels: {
      resistance: round(resistance),
      risk: riskLine,
      support: round(support),
    },
    levelSummary: {
      daily: dailySummary(trend, centerRange, latestClose),
      hourly60:
        last(hourly60).close > hourlyMa10 ? "60 分钟站上短均线" : "60 分钟仍在短均线下方",
      weekly: last(weekly).close >= movingAverage(weekly, 5) ? "周线保持修复" : "周线仍需修复",
    },
    riskFlags,
    sellPointLabel,
    structureSignal,
    summary: summaryFor(structureSignal, centerRange),
    trend,
  };
}

function deriveDataHealth(input: TechnicalStructureInput): DataHealth {
  if (input.daily.length >= 20 && input.weekly.length >= 8 && input.hourly60.length >= 20) {
    return "ready";
  }
  if (input.daily.length > 0 || input.weekly.length > 0 || input.hourly60.length > 0) {
    return "missing";
  }
  return "missing";
}

function deriveTrend(close: number, ma5: number, ma20: number): Trend {
  if (close >= ma5 && ma5 >= ma20) {
    return "up";
  }
  if (close <= ma5 && ma5 <= ma20) {
    return "down";
  }
  return "range";
}

function deriveCenterRange(daily: KLineBar[]): StructureRange {
  const recent = daily.slice(-12);
  const low = percentile(
    recent.map((bar) => bar.low),
    0.35,
  );
  const high = percentile(
    recent.map((bar) => bar.high),
    0.65,
  );
  return { high: round(high), low: round(low) };
}

function deriveStructureSignal({
  centerRange,
  hourly60,
  hourlyMa10,
  latestClose,
  resistance,
  riskFlags,
  trend,
  weekly,
}: {
  centerRange: StructureRange;
  hourly60: KLineBar[];
  hourlyMa10: number;
  latestClose: number;
  resistance: number;
  riskFlags: string[];
  trend: Trend;
  weekly: KLineBar[];
}): StructureSignal {
  if (riskFlags.length > 0) {
    return "risk_sell_candidate";
  }

  const weeklyRepairing = last(weekly).close >= movingAverage(weekly, 5);
  const hourlyConfirming = last(hourly60).close > hourlyMa10;
  if (trend === "up" && weeklyRepairing && hourlyConfirming && latestClose > centerRange.high) {
    return latestClose > resistance ? "second_buy_confirmed" : "second_buy_candidate";
  }

  if (trend !== "down" && hourlyConfirming && latestClose >= centerRange.low) {
    return "second_buy_candidate";
  }

  return "none";
}

function buyPointLabelFor(signal: StructureSignal): TechnicalStructureAnalysis["buyPointLabel"] {
  if (signal === "second_buy_confirmed") {
    return "二买确认";
  }
  if (signal === "second_buy_candidate") {
    return "二买候选";
  }
  return "无买点";
}

function dailySummary(trend: Trend, centerRange: StructureRange, latestClose: number): string {
  if (latestClose > centerRange.high) {
    return `日线站上中枢上沿 ${centerRange.high}`;
  }
  if (latestClose < centerRange.low) {
    return `日线跌破中枢下沿 ${centerRange.low}`;
  }
  return trend === "up" ? "日线趋势向上，仍在中枢内震荡" : "日线处于中枢震荡";
}

function summaryFor(signal: StructureSignal, centerRange: StructureRange): string {
  if (signal === "second_buy_confirmed") {
    return `价格突破中枢上沿 ${centerRange.high}，二买结构已确认，仍需人工复核赔率。`;
  }
  if (signal === "second_buy_candidate") {
    return `价格围绕中枢 ${centerRange.low}-${centerRange.high} 修复，二买候选出现，等待小级别确认。`;
  }
  if (signal === "risk_sell_candidate") {
    return `价格跌破中枢或近期防守位，出现风险卖点候选，先控制回撤。`;
  }
  return `结构未给出明确买点，继续观察中枢 ${centerRange.low}-${centerRange.high} 的方向选择。`;
}

function sortedBars(bars: KLineBar[]): KLineBar[] {
  return [...bars].sort((left, right) => left.date.localeCompare(right.date));
}

function movingAverage(bars: KLineBar[], windowSize: number): number {
  const window = bars.slice(-windowSize);
  return window.reduce((sum, bar) => sum + bar.close, 0) / window.length;
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)));
  return sorted[index];
}

function last<T>(values: T[]): T {
  return values[values.length - 1];
}

function min(values: number[]): number {
  return Math.min(...values);
}

function max(values: number[]): number {
  return Math.max(...values);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
