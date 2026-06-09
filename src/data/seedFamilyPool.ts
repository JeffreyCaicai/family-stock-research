import type { DataSyncSnapshot } from "../domain/dataSync";
import type { DecisionInput } from "../domain/decision";
import type { FamilyPoolItem } from "../domain/familyPool";
import { createFamilyPoolItem } from "../domain/familyPool";
import type { TechnicalStructureAnalysis } from "../domain/technicalStructure";

export type SeedStock = FamilyPoolItem & {
  name: string;
  price: number;
  dataHealthLabel: string;
  dataSync: DataSyncSnapshot;
  decisionInput: DecisionInput;
  structureAnalysis?: TechnicalStructureAnalysis;
};

export const seedFamilyPool: SeedStock[] = [
  {
    ...createFamilyPoolItem("688041", { status: "holding", tags: ["AI", "爸爸关注"] }),
    name: "海光信息",
    price: 274.06,
    dataHealthLabel: "行情、日线、周线、60 分钟线可用",
    dataSync: {
      state: "sample",
      source: "本地种子数据",
      detail: "用于验证分析流程，等待接入真实行情同步",
    },
    decisionInput: {
      dataHealth: "ready",
      riskFlags: [],
      trend: "up",
      structureSignal: "second_buy_confirmed",
    },
    structureAnalysis: {
      buyPointLabel: "二买候选",
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
      summary: "围绕中枢上沿修复，二买结构进入确认观察。",
      trend: "up",
    },
  },
  {
    ...createFamilyPoolItem("002916", { status: "holding", tags: ["PCB", "稳健复盘"] }),
    name: "深南电路",
    price: 399.13,
    dataHealthLabel: "行情和日线可用，等待更多财务复核",
    dataSync: {
      state: "sample",
      source: "本地种子数据",
      detail: "用于验证分析流程，等待接入真实行情同步",
    },
    decisionInput: {
      dataHealth: "ready",
      riskFlags: [],
      trend: "up",
      structureSignal: "none",
    },
  },
  {
    ...createFamilyPoolItem("688630", { status: "watching", tags: ["半导体设备"] }),
    name: "芯碁微装",
    price: 356.01,
    dataHealthLabel: "行情可用，风险结构需复盘",
    dataSync: {
      state: "sample",
      source: "本地种子数据",
      detail: "用于验证分析流程，等待接入真实行情同步",
    },
    decisionInput: {
      dataHealth: "ready",
      riskFlags: ["出现风险卖点候选"],
      trend: "range",
      structureSignal: "risk_sell_candidate",
    },
  },
];
