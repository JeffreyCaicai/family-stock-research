import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_POOL_PATH = resolve(ROOT, "data", "family-pool.json");
export const DEFAULT_PORT = 8787;
const SYNC_SCRIPT_PATH = resolve(ROOT, "scripts", "sync_market_data.py");
const execFileAsync = promisify(execFile);

const validStatuses = new Set(["holding", "watching", "researching", "paused"]);

export async function readFamilyPool(poolPath = DEFAULT_POOL_PATH) {
  const raw = await readFile(poolPath, "utf-8");
  return normalizeFamilyPoolItems(JSON.parse(raw));
}

export async function writeFamilyPool(items, poolPath = DEFAULT_POOL_PATH) {
  const normalized = normalizeFamilyPoolItems(items);
  await writeFile(poolPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

export function createFamilyPoolApiServer({
  poolPath = DEFAULT_POOL_PATH,
  syncMarketData = syncMarketDataWithPython,
} = {}) {
  return createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const pathname = getRequestPathname(request.url);
    if (pathname !== "/api/family-pool" && pathname !== "/api/market-sync") {
      writeJson(response, 404, { error: "Not found" });
      return;
    }

    try {
      if (pathname === "/api/family-pool" && request.method === "GET") {
        writeJson(response, 200, { items: await readFamilyPool(poolPath) });
        return;
      }

      if (
        pathname === "/api/family-pool" &&
        (request.method === "PUT" || request.method === "POST")
      ) {
        const body = await readRequestBody(request);
        const parsed = body ? JSON.parse(body) : {};
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        writeJson(response, 200, { items: await writeFamilyPool(items ?? [], poolPath) });
        return;
      }

      if (pathname === "/api/market-sync" && request.method === "POST") {
        const body = await readRequestBody(request);
        const parsed = body ? JSON.parse(body) : {};
        const ticker = normalizeTicker(String(parsed.ticker ?? ""));
        if (!ticker) {
          writeJson(response, 400, { error: "Invalid ticker" });
          return;
        }

        writeJson(
          response,
          200,
          await syncMarketData({
            provider: normalizeProvider(String(parsed.provider ?? "auto")),
            ticker,
          }),
        );
        return;
      }

      writeJson(response, 405, { error: "Method not allowed" });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Bad request",
      });
    }
  });
}

export async function syncMarketDataWithPython({
  provider = "auto",
  syncTimeoutMs = 45000,
  ticker,
  pythonBin = process.env.PYTHON_BIN || "python3",
} = {}) {
  const normalizedTicker = normalizeTicker(String(ticker ?? ""));
  if (!normalizedTicker) {
    throw new Error("Invalid ticker");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "family-market-sync-"));
  const outputPath = join(tempDir, "marketSnapshots.json");
  const normalizedProvider = normalizeProvider(provider);
  try {
    await execFileAsync(
      pythonBin,
      [
        SYNC_SCRIPT_PATH,
        "--provider",
        normalizedProvider,
        "--tickers",
        normalizedTicker,
        "--output",
        outputPath,
      ],
      { timeout: syncTimeoutMs },
    );

    return {
      provider: normalizedProvider,
      snapshots: JSON.parse(await readFile(outputPath, "utf-8")),
    };
  } catch {
    return {
      provider: normalizedProvider,
      snapshots: [failedMarketSyncSnapshot(normalizedTicker, normalizedProvider)],
    };
  }
}

export function normalizeFamilyPoolItems(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const byTicker = new Map();
  for (const item of input) {
    const ticker = normalizeTicker(String(item?.ticker ?? ""));
    if (!ticker || byTicker.has(ticker)) {
      continue;
    }
    byTicker.set(ticker, {
      ticker,
      status: normalizeStatus(String(item?.status ?? "watching")),
      tags: normalizeTags(item?.tags),
    });
  }

  return Array.from(byTicker.values()).sort((left, right) =>
    left.ticker.localeCompare(right.ticker),
  );
}

function normalizeTicker(input) {
  let ticker = input.trim().toUpperCase();
  if (ticker.startsWith("SH") || ticker.startsWith("SZ")) {
    ticker = ticker.slice(2);
  }
  return /^\d{6}$/.test(ticker) ? ticker : "";
}

function normalizeStatus(input) {
  return validStatuses.has(input) ? input : "watching";
}

function normalizeProvider(input) {
  return input === "akshare" || input === "baostock" || input === "fixture" ? input : "auto";
}

function failedMarketSyncSnapshot(ticker, source) {
  return {
    ticker,
    dataHealthLabel: `${source} 真实数据同步失败，不能下操作结论`,
    dataSync: {
      state: "failed",
      source,
      detail: "真实数据同步超时或失败",
      attempts: [
        {
          source,
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
  };
}

function normalizeTags(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const tags = [];
  for (const tag of input) {
    const text = String(tag).trim();
    if (text && !tags.includes(text)) {
      tags.push(text);
    }
  }
  return tags;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
}

function getRequestPathname(url) {
  try {
    return new URL(url ?? "", "http://localhost").pathname;
  } catch {
    return "";
  }
}

function writeJson(response, status, payload) {
  response.writeHead(status, {
    "connection": "close",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createFamilyPoolApiServer();
  server.listen(DEFAULT_PORT, "127.0.0.1", () => {
    console.log(`Family pool API listening on http://localhost:${DEFAULT_PORT}`);
  });
}
