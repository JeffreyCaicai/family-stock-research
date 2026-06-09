import type { FamilyPoolItem, FamilyPoolStatus } from "../domain/familyPool";
import { createFamilyPoolItem, mergeFamilyPoolItems, normalizeTicker } from "../domain/familyPool";
import type { MarketSnapshot } from "./marketSnapshots";

export const FAMILY_POOL_API_URL = "http://localhost:8787/api/family-pool";
export const MARKET_SYNC_API_URL = "http://localhost:8787/api/market-sync";

export async function loadFamilyPoolFromApi(): Promise<FamilyPoolItem[] | null> {
  if (typeof fetch === "undefined") {
    return null;
  }

  try {
    const response = await fetch(FAMILY_POOL_API_URL);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload.items;
    return toApiItems(items ?? []);
  } catch {
    return null;
  }
}

export async function saveFamilyPoolToApi(items: FamilyPoolItem[]): Promise<boolean> {
  if (typeof fetch === "undefined") {
    return false;
  }

  try {
    const response = await fetch(FAMILY_POOL_API_URL, {
      body: JSON.stringify({ items: toApiItems(items) }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function refreshMarketSnapshotFromApi(
  tickerInput: string,
): Promise<MarketSnapshot[] | null> {
  if (typeof fetch === "undefined") {
    return null;
  }

  try {
    const ticker = normalizeTicker(tickerInput);
    const response = await fetch(MARKET_SYNC_API_URL, {
      body: JSON.stringify({ provider: "auto", ticker }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload.snapshots ?? [];
  } catch {
    return null;
  }
}

type ApiFamilyPoolItem = {
  ticker: string;
  status?: unknown;
  tags?: unknown;
};

function toApiItems(items: ApiFamilyPoolItem[]): FamilyPoolItem[] {
  return mergeFamilyPoolItems(items.map(toFamilyPoolItem))
    .map((item) => ({
      ticker: item.ticker,
      status: item.status,
      tags: item.tags,
    }))
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
}

function toFamilyPoolItem(item: ApiFamilyPoolItem): FamilyPoolItem {
  return createFamilyPoolItem(item.ticker, {
    status: normalizeStatus(item.status),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
  });
}

function normalizeStatus(status: unknown): FamilyPoolStatus {
  if (
    status === "holding" ||
    status === "watching" ||
    status === "researching" ||
    status === "paused"
  ) {
    return status;
  }
  return "watching";
}
