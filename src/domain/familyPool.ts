export type FamilyPoolStatus = "holding" | "watching" | "researching" | "paused";

export type FamilyPoolItem = {
  ticker: string;
  status: FamilyPoolStatus;
  tags: string[];
};

type CreateFamilyPoolItemOptions = {
  status?: FamilyPoolStatus;
  tags?: string[];
};

export function normalizeTicker(input: string): string {
  const digits = input.trim().toUpperCase().replace(/^S[HZ]/, "").match(/\d{6}/)?.[0];
  if (!digits) {
    throw new Error(`Invalid A-share ticker: ${input}`);
  }
  return digits;
}

export function createFamilyPoolItem(
  ticker: string,
  options: CreateFamilyPoolItemOptions = {},
): FamilyPoolItem {
  return {
    ticker: normalizeTicker(ticker),
    status: options.status ?? "watching",
    tags: uniqueTags(options.tags ?? []),
  };
}

export function mergeFamilyPoolItems(items: FamilyPoolItem[]): FamilyPoolItem[] {
  const byTicker = new Map<string, FamilyPoolItem>();

  for (const item of items) {
    const ticker = normalizeTicker(item.ticker);
    const existing = byTicker.get(ticker);

    if (!existing) {
      byTicker.set(ticker, {
        ticker,
        status: item.status,
        tags: uniqueTags(item.tags),
      });
      continue;
    }

    byTicker.set(ticker, {
      ticker,
      status: existing.status,
      tags: uniqueTags([...existing.tags, ...item.tags]),
    });
  }

  return Array.from(byTicker.values());
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}
