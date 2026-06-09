import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_POOL_PATH = resolve(ROOT, "data", "family-pool.json");
export const DEFAULT_PORT = 8787;

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

export function createFamilyPoolApiServer({ poolPath = DEFAULT_POOL_PATH } = {}) {
  return createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (!request.url?.startsWith("/api/family-pool")) {
      writeJson(response, 404, { error: "Not found" });
      return;
    }

    try {
      if (request.method === "GET") {
        writeJson(response, 200, { items: await readFamilyPool(poolPath) });
        return;
      }

      if (request.method === "PUT" || request.method === "POST") {
        const body = await readRequestBody(request);
        const parsed = body ? JSON.parse(body) : {};
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        writeJson(response, 200, { items: await writeFamilyPool(items ?? [], poolPath) });
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

function writeJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createFamilyPoolApiServer();
  server.listen(DEFAULT_PORT, "127.0.0.1", () => {
    console.log(`Family pool API listening on http://localhost:${DEFAULT_PORT}`);
  });
}
