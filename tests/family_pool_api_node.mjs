import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createFamilyPoolApiServer, readFamilyPool, writeFamilyPool } from "../scripts/family_pool_api.mjs";

let server;
let baseUrl;
let poolPath;

before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "family-pool-api-"));
  poolPath = join(dir, "family-pool.json");
  await writeFile(
    poolPath,
    JSON.stringify([{ ticker: "688041", status: "holding", tags: ["AI"] }]),
    "utf-8",
  );
  server = createFamilyPoolApiServer({
    poolPath,
    syncMarketData: async ({ provider, ticker }) => ({
      provider,
      snapshots: [
        {
          ticker,
          name: "海光信息",
          price: 281.12,
          dataSync: {
            state: "synced",
            source: provider,
            detail: "测试同步完成",
          },
        },
      ],
    }),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

test("readFamilyPool normalizes tickers, status, and tags", async () => {
  await writeFamilyPool(
    [
      { ticker: "sh688041", status: "holding", tags: ["AI", "AI", " 爸爸关注 "] },
      { ticker: "bad-code", status: "watching", tags: ["忽略"] },
      { ticker: "002916" },
    ],
    poolPath,
  );

  assert.deepEqual(await readFamilyPool(poolPath), [
    { ticker: "002916", status: "watching", tags: [] },
    { ticker: "688041", status: "holding", tags: ["AI", "爸爸关注"] },
  ]);
});

test("GET /api/family-pool returns normalized items", async () => {
  const response = await fetch(`${baseUrl}/api/family-pool`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [
      { ticker: "002916", status: "watching", tags: [] },
      { ticker: "688041", status: "holding", tags: ["AI", "爸爸关注"] },
    ],
  });
});

test("PUT /api/family-pool writes normalized items to disk", async () => {
  const response = await fetch(`${baseUrl}/api/family-pool`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [
        { ticker: "600519", status: "researching", tags: ["白酒", "爸爸关注"] },
        { ticker: "sz002916", status: "bad", tags: ["PCB"] },
      ],
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [
      { ticker: "002916", status: "watching", tags: ["PCB"] },
      { ticker: "600519", status: "researching", tags: ["白酒", "爸爸关注"] },
    ],
  });
  assert.match(await readFile(poolPath, "utf-8"), /600519/);
});

test("POST /api/market-sync refreshes a single stock snapshot", async () => {
  const response = await fetch(`${baseUrl}/api/market-sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "akshare", ticker: "sh688041" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    provider: "akshare",
    snapshots: [
      {
        ticker: "688041",
        name: "海光信息",
        price: 281.12,
        dataSync: {
          state: "synced",
          source: "akshare",
          detail: "测试同步完成",
        },
      },
    ],
  });
});
