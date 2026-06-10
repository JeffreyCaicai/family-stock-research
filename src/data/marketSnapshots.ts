import type { DataSyncSnapshot } from "../domain/dataSync";
import type { DecisionInput } from "../domain/decision";
import { normalizeTicker } from "../domain/familyPool";
import type { TechnicalStructureAnalysis } from "../domain/technicalStructure";
import rawMarketSnapshots from "./generated/marketSnapshots.json";
import type { SeedStock } from "./seedFamilyPool";

export type MarketSnapshot = {
  ticker: string;
  dataSync: DataSyncSnapshot;
  dataHealthLabel?: string;
  decisionInput?: DecisionInput;
  name?: string;
  price?: number;
  structureAnalysis?: TechnicalStructureAnalysis | null;
};

export const marketSnapshots: MarketSnapshot[] = normalizeMarketSnapshots(rawMarketSnapshots);

export function applyMarketSnapshots(
  stocks: SeedStock[],
  snapshots: MarketSnapshot[] = marketSnapshots,
): SeedStock[] {
  const byTicker = new Map(snapshots.map((snapshot) => [normalizeTicker(snapshot.ticker), snapshot]));

  return stocks.map((stock) => {
    const snapshot = byTicker.get(stock.ticker);
    if (!snapshot) {
      return stock;
    }

    const next: SeedStock = {
      ...stock,
      dataHealthLabel: snapshot.dataHealthLabel ?? stock.dataHealthLabel,
      dataSync: snapshot.dataSync,
      decisionInput: snapshot.decisionInput ?? stock.decisionInput,
      name: snapshot.name ?? stock.name,
      price:
        snapshot.price ??
        (snapshot.dataSync.state === "failed" || snapshot.dataSync.state === "pending"
          ? 0
          : stock.price),
      structureAnalysis:
        "structureAnalysis" in snapshot
          ? (snapshot.structureAnalysis ?? undefined)
          : stock.structureAnalysis,
    };
    return next;
  });
}

function normalizeMarketSnapshots(input: unknown): MarketSnapshot[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map(toMarketSnapshot).filter(isMarketSnapshot);
}

function toMarketSnapshot(input: unknown): MarketSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<MarketSnapshot>;
  if (!candidate.ticker || !candidate.dataSync) {
    return null;
  }

  try {
    return {
      ticker: normalizeTicker(candidate.ticker),
      dataSync: candidate.dataSync,
      dataHealthLabel: candidate.dataHealthLabel,
      decisionInput: candidate.decisionInput,
      name: candidate.name,
      price: candidate.price,
      structureAnalysis: candidate.structureAnalysis,
    };
  } catch {
    return null;
  }
}

function isMarketSnapshot(value: MarketSnapshot | null): value is MarketSnapshot {
  return value !== null;
}
