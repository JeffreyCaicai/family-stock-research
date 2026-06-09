import { afterEach, describe, expect, it, vi } from "vitest";
import { saveFamilyPoolToApi } from "./familyPoolApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saveFamilyPoolToApi", () => {
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
});
