import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFamilyPoolFromApi, refreshMarketSnapshotFromApi, saveFamilyPoolToApi } from "./familyPoolApi";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("saveFamilyPoolToApi", () => {
  it("loads normalized family pool items from the local API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { ticker: "sh688041", status: "holding", tags: ["AI", "AI"] },
            { ticker: "002916", status: "bad", tags: ["PCB"] },
          ],
        }),
      }),
    );

    await expect(loadFamilyPoolFromApi()).resolves.toEqual([
      { ticker: "002916", status: "watching", tags: ["PCB"] },
      { ticker: "688041", status: "holding", tags: ["AI"] },
    ]);
  });

  it("returns null when the local API cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(loadFamilyPoolFromApi()).resolves.toBeNull();
  });

  it("sends normalized family pool items to the local API", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const saved = await saveFamilyPoolToApi([
      { ticker: "sh688041", status: "holding", tags: ["AI", "AI"] },
      { ticker: "002916", status: "watching", tags: ["PCB"] },
    ]);

    expect(saved).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:8787/api/family-pool",
      expect.objectContaining({
        body: JSON.stringify({
          items: [
            { ticker: "002916", status: "watching", tags: ["PCB"] },
            { ticker: "688041", status: "holding", tags: ["AI"] },
          ],
        }),
        method: "PUT",
      }),
    );
  });

  it("returns false when the local API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(saveFamilyPoolToApi([])).resolves.toBe(false);
  });

  it("refreshes one ticker through the local market sync API", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        snapshots: [
          {
            ticker: "688041",
            name: "海光信息",
            price: 281.12,
            dataSync: { state: "synced", source: "AKShare", detail: "同步完成" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(refreshMarketSnapshotFromApi("sh688041")).resolves.toEqual([
      {
        ticker: "688041",
        name: "海光信息",
        price: 281.12,
        dataSync: { state: "synced", source: "AKShare", detail: "同步完成" },
      },
    ]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:8787/api/market-sync",
      expect.objectContaining({
        body: JSON.stringify({ provider: "auto", ticker: "688041" }),
        method: "POST",
      }),
    );
  });
});
