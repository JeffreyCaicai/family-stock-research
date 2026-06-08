import { afterEach, describe, expect, it } from "vitest";
import { createFamilyPoolItem } from "../domain/familyPool";
import {
  FAMILY_POOL_STORAGE_KEY,
  loadFamilyPoolItems,
  saveFamilyPoolItems,
} from "./familyPoolRepository";

afterEach(() => {
  window.localStorage.clear();
});

describe("familyPoolRepository", () => {
  it("saves and loads family pool items from localStorage", () => {
    saveFamilyPoolItems([
      createFamilyPoolItem("600519", {
        status: "researching",
        tags: ["白酒", "爸爸关注"],
      }),
    ]);

    expect(loadFamilyPoolItems()).toEqual([
      {
        ticker: "600519",
        status: "researching",
        tags: ["白酒", "爸爸关注"],
      },
    ]);
  });

  it("returns an empty list when storage data is unavailable or invalid", () => {
    window.localStorage.setItem(FAMILY_POOL_STORAGE_KEY, "{bad json");

    expect(loadFamilyPoolItems()).toEqual([]);
  });
});
