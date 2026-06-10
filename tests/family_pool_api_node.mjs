import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import {
  applyMarketCache,
  createFamilyPoolApiServer,
  readFamilyPool,
  syncMarketDataWithPython,
  writeFamilyPool,
} from "../scripts/family_pool_api.mjs";

let server;
let baseUrl;
let cachePath;
let poolPath;

before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "family-pool-api-"));
  cachePath = join(dir, "market-cache.json");
  poolPath = join(dir, "family-pool.json");
  await writeFile(
    poolPath,
    JSON.stringify([{ ticker: "688041", status: "holding", tags: ["AI"] }]),
    "utf-8",
  );
  server = createFamilyPoolApiServer({
    cachePath,
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

test("GET /api/family-pool allows the 127 localhost app origin", async () => {
  const response = await fetch(`${baseUrl}/api/family-pool`, {
    headers: { origin: "http://127.0.0.1:5173" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173");
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
    body: JSON.stringify({ provider: "auto", ticker: "sh688041" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    provider: "auto",
    snapshots: [
      {
        ticker: "688041",
        name: "海光信息",
        price: 281.12,
        dataSync: {
          state: "synced",
          source: "auto",
          detail: "测试同步完成",
        },
      },
    ],
  });
});

test("syncMarketDataWithPython returns a failed snapshot when the provider command times out", async () => {
  const dir = await mkdtemp(join(tmpdir(), "family-pool-timeout-"));
  const slowCommand = join(dir, "slow-provider.mjs");
  await writeFile(
    slowCommand,
    "#!/usr/bin/env node\nsetTimeout(() => {}, 1000);\n",
    "utf-8",
  );
  await chmod(slowCommand, 0o755);

  const result = await syncMarketDataWithPython({
    provider: "auto",
    pythonBin: slowCommand,
    syncTimeoutMs: 20,
    ticker: "688041",
  });

  assert.equal(result.provider, "auto");
  assert.deepEqual(result.snapshots, [
    {
      ticker: "688041",
      dataHealthLabel: "auto 真实数据同步失败，不能下操作结论",
      dataSync: {
        state: "failed",
        source: "auto",
        detail: "真实数据同步超时或失败",
        attempts: [
          {
            source: "auto",
            state: "failed",
            detail: "真实数据同步超时或失败",
          },
        ],
      },
      decisionInput: {
        dataHealth: "missing",
        riskFlags: ["真实数据同步失败"],
        structureSignal: "none",
        trend: "range",
      },
      structureAnalysis: null,
    },
  ]);
});

test("applyMarketCache uses cached snapshot after a provider failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "family-pool-cache-api-"));
  const localCachePath = join(dir, "market-cache.json");

  await applyMarketCache(
    {
      provider: "auto",
      snapshots: [
        {
          ticker: "688041",
          name: "海光信息",
          price: 281.12,
          dataSync: {
            state: "synced",
            source: "AKShare",
            detail: "测试同步完成",
          },
        },
      ],
    },
    localCachePath,
  );

  assert.deepEqual(
    await applyMarketCache(
      {
        provider: "auto",
        snapshots: [
          {
            ticker: "688041",
            dataHealthLabel: "auto 真实数据同步失败，不能下操作结论",
            dataSync: {
              state: "failed",
              source: "auto",
              detail: "真实数据同步超时或失败",
            },
            decisionInput: {
              dataHealth: "missing",
              riskFlags: ["真实数据同步失败"],
              structureSignal: "none",
              trend: "range",
            },
            structureAnalysis: null,
          },
        ],
      },
      localCachePath,
    ),
    {
      provider: "auto",
      snapshots: [
        {
          ticker: "688041",
          name: "海光信息",
          price: 281.12,
          dataHealthLabel: "使用缓存行情，真实数据源本次同步失败",
          dataSync: {
            state: "synced",
            source: "cache",
            detail: "真实数据源本次同步失败，暂用最近一次可信快照",
          },
        },
      ],
    },
  );
});
