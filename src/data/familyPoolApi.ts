import type { FamilyPoolItem } from "../domain/familyPool";
import { mergeFamilyPoolItems } from "../domain/familyPool";

export const FAMILY_POOL_API_URL = "http://localhost:8787/api/family-pool";

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

function toApiItems(items: FamilyPoolItem[]): FamilyPoolItem[] {
  return mergeFamilyPoolItems(items)
    .map((item) => ({
      ticker: item.ticker,
      status: item.status,
      tags: item.tags,
    }))
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
}
