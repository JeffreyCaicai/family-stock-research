import type { FamilyPoolItem, FamilyPoolStatus } from "../domain/familyPool";
import { createFamilyPoolItem, mergeFamilyPoolItems } from "../domain/familyPool";

export const FAMILY_POOL_STORAGE_KEY = "family-stock-research:family-pool:v1";

const validStatuses: FamilyPoolStatus[] = ["holding", "watching", "researching", "paused"];

export function loadFamilyPoolItems(): FamilyPoolItem[] {
  if (!storageAvailable()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAMILY_POOL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return mergeFamilyPoolItems(parsed.map(toFamilyPoolItem).filter(isFamilyPoolItem));
  } catch {
    return [];
  }
}

export function saveFamilyPoolItems(items: FamilyPoolItem[]): void {
  if (!storageAvailable()) {
    return;
  }

  window.localStorage.setItem(
    FAMILY_POOL_STORAGE_KEY,
    JSON.stringify(mergeFamilyPoolItems(items)),
  );
}

function toFamilyPoolItem(value: unknown): FamilyPoolItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<FamilyPoolItem>;
  if (typeof candidate.ticker !== "string") {
    return null;
  }

  const status = validStatuses.includes(candidate.status as FamilyPoolStatus)
    ? (candidate.status as FamilyPoolStatus)
    : "watching";

  try {
    return createFamilyPoolItem(candidate.ticker, {
      status,
      tags: Array.isArray(candidate.tags) ? candidate.tags.filter(isString) : [],
    });
  } catch {
    return null;
  }
}

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFamilyPoolItem(value: FamilyPoolItem | null): value is FamilyPoolItem {
  return value !== null;
}
