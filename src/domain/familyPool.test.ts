import { describe, expect, it } from "vitest";
import {
  createFamilyPoolItem,
  mergeFamilyPoolItems,
  normalizeTicker,
} from "./familyPool";

describe("family pool domain", () => {
  it("normalizes A-share tickers to six digits", () => {
    expect(normalizeTicker("688041.SH")).toBe("688041");
    expect(normalizeTicker(" sz002916 ")).toBe("002916");
  });

  it("creates a default watching item from a ticker", () => {
    expect(createFamilyPoolItem("688041")).toEqual({
      ticker: "688041",
      status: "watching",
      tags: [],
    });
  });

  it("merges duplicate tickers while preserving status and unique tags", () => {
    const merged = mergeFamilyPoolItems([
      createFamilyPoolItem("688041", { status: "holding", tags: ["爸爸关注", "AI"] }),
      createFamilyPoolItem("688041.SH", { status: "watching", tags: ["AI", "风险复盘"] }),
      createFamilyPoolItem("002916", { tags: ["PCB"] }),
    ]);

    expect(merged).toEqual([
      {
        ticker: "688041",
        status: "holding",
        tags: ["爸爸关注", "AI", "风险复盘"],
      },
      {
        ticker: "002916",
        status: "watching",
        tags: ["PCB"],
      },
    ]);
  });
});
