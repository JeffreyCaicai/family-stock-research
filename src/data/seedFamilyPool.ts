import type { DecisionInput } from "../domain/decision";
import type { FamilyPoolItem } from "../domain/familyPool";
import { createFamilyPoolItem } from "../domain/familyPool";

export type SeedStock = FamilyPoolItem & {
  name: string;
  price: number;
  dataHealthLabel: string;
  decisionInput: DecisionInput;
};

export const seedFamilyPool: SeedStock[] = [
  {
    ...createFamilyPoolItem("688041", { status: "holding", tags: ["AI", "爸爸关注"] }),
    name: "海光信息",
    price: 274.06,
    dataHealthLabel: "行情、日线、周线、60 分钟线可用",
    decisionInput: {
      dataHealth: "ready",
      riskFlags: [],
      trend: "up",
      structureSignal: "second_buy_confirmed",
    },
  },
  {
    ...createFamilyPoolItem("002916", { status: "holding", tags: ["PCB", "稳健复盘"] }),
    name: "深南电路",
    price: 399.13,
    dataHealthLabel: "行情和日线可用，等待更多财务复核",
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
    decisionInput: {
      dataHealth: "ready",
      riskFlags: ["出现风险卖点候选"],
      trend: "range",
      structureSignal: "risk_sell_candidate",
    },
  },
];
