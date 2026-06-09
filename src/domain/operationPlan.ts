import type { Decision, DecisionTone } from "./decision";
import type { FamilyPoolStatus } from "./familyPool";
import type { TechnicalStructureAnalysis } from "./technicalStructure";

export type PrimaryAction =
  | "先补齐数据"
  | "继续持有"
  | "等待确认"
  | "可小仓试探"
  | "减仓观察"
  | "只观察不加仓";

export type OperationPlan = {
  checklist: string[];
  invalidation: string;
  positionRule: string;
  primaryAction: PrimaryAction;
  tone: DecisionTone;
  trigger: string;
};

export type OperationPlanInput = {
  decision: Decision;
  price: number;
  status: FamilyPoolStatus;
  structure?: TechnicalStructureAnalysis;
};

export function deriveOperationPlan(input: OperationPlanInput): OperationPlan {
  if (input.decision.label === "数据不足，暂不下结论" || !input.structure) {
    return {
      checklist: [
        "先运行行情同步，补齐日线、周线和 60 分钟线",
        "确认股票名称、现价和同步时间无误",
        "数据不足前不做加仓或新买入决策",
      ],
      invalidation: "暂无有效失效条件，等待结构数据生成后再设定。",
      positionRule: "不新增仓位，只完成数据准备和人工复核。",
      primaryAction: "先补齐数据",
      tone: "neutral",
      trigger: "同步真实行情和 K 线后再重新生成结论。",
    };
  }

  if (input.decision.tone === "risk") {
    return {
      checklist: [
        "先确认风险卖点是否由真实 K 线触发",
        "复盘是否破坏原来的持有逻辑",
        "若不能快速收回防守位，优先降低回撤风险",
      ],
      invalidation: `${input.structure.sellPointLabel} 仍在，或价格继续跌破 ${formatLevel(
        input.structure.keyLevels.risk,
      )}。`,
      positionRule:
        input.status === "holding"
          ? "已持仓先保护本金和回撤，不把风险信号解释成补仓机会。"
          : "未持仓不急于买入，先等风险结构解除。",
      primaryAction: input.status === "holding" ? "减仓观察" : "只观察不加仓",
      tone: "risk",
      trigger: `只有重新站回关键结构位 ${formatLevel(
        input.structure.keyLevels.support,
      )} 后，才进入下一轮观察。`,
    };
  }

  if (input.decision.label === "可小仓试探") {
    return {
      checklist: [
        "只在触发条件满足后行动，不提前把候选信号当成确认信号",
        "先设好失效位，再考虑试探仓",
        "试探后若不能继续走强，不追加仓位",
      ],
      invalidation: `跌破 ${formatLevel(input.structure.keyLevels.risk)}，说明结构确认失败。`,
      positionRule: "只允许试探仓，不能一次性重仓，也不在放量冲高后追价。",
      primaryAction: "可小仓试探",
      tone: "opportunity",
      trigger: `站稳 ${formatLevel(input.structure.keyLevels.resistance)}，或回踩 ${formatLevel(
        input.structure.keyLevels.support,
      )} 不破后再行动。`,
    };
  }

  if (input.decision.label === "等待二买确认") {
    return {
      checklist: [
        "观察 60 分钟回踩是否不破中枢下沿",
        "等待重新放量站回短周期强势区",
        "确认前不把观察仓扩大成正式仓位",
      ],
      invalidation: `跌破 ${formatLevel(input.structure.keyLevels.risk)} 后，二买候选失效。`,
      positionRule: "维持观察或极轻仓跟踪，等待确认信号。",
      primaryAction: "等待确认",
      tone: "wait",
      trigger: `60 分钟级别重新站强，并且价格不破 ${formatLevel(
        input.structure.keyLevels.support,
      )}。`,
    };
  }

  if (input.decision.label === "可继续持有") {
    return {
      checklist: [
        "继续跟踪趋势是否破坏",
        "只在回撤不破防守位时维持原计划",
        "若出现新的风险卖点，重新进入风险复盘",
      ],
      invalidation: `跌破 ${formatLevel(input.structure.keyLevels.risk)} 后，持有逻辑需要复盘。`,
      positionRule: "原仓位可继续观察，不因短线波动频繁改变计划。",
      primaryAction: "继续持有",
      tone: "hold",
      trigger: "趋势未破坏且没有新增高优先级风险。",
    };
  }

  return {
    checklist: [
      "等待结构或赔率出现更清晰的改善",
      "不因为价格短期上涨就追高",
      "下一次同步后重新检查中枢和风险位",
    ],
    invalidation: "若跌破结构防守位，转入风险复盘。",
    positionRule: "暂不加仓，也不新买入。",
    primaryAction: "只观察不加仓",
    tone: "wait",
    trigger: "需要更清晰的买点确认或赔率改善。",
  };
}

function formatLevel(level: number | undefined): string {
  return typeof level === "number" ? String(level) : "关键位";
}
