#!/usr/bin/env python3
"""Generate frontend market snapshot JSON for the family stock pool.

The default fixture provider is intentionally offline and deterministic. The
AKShare provider is optional and will be wired deeper once the local Python
environment has the dependency and we validate field mappings against real data.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POOL = ROOT / "data" / "family-pool.json"
DEFAULT_FIXTURE = ROOT / "data" / "market-sync-fixture.json"
DEFAULT_OUTPUT = ROOT / "src" / "data" / "generated" / "marketSnapshots.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync market snapshots for family stocks.")
    parser.add_argument("--pool", default=str(DEFAULT_POOL), help="JSON file with tickers to sync.")
    parser.add_argument(
        "--provider",
        choices=["fixture", "akshare"],
        default="fixture",
        help="Data provider. fixture is offline; akshare requires the Python package.",
    )
    parser.add_argument(
        "--fixture",
        default=str(DEFAULT_FIXTURE),
        help="Fixture JSON used by the offline provider.",
    )
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Snapshot JSON output path.")
    args = parser.parse_args()

    pool_items = read_family_pool_items(Path(args.pool))
    tickers = [item["ticker"] for item in pool_items]
    if args.provider == "fixture":
        snapshots = sync_from_fixture(tickers, Path(args.fixture))
    else:
        snapshots = sync_from_akshare(tickers)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(snapshots, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(snapshots)} market snapshots to {output}")


def read_family_pool_items(path: Path) -> list[dict[str, Any]]:
    raw_items = json.loads(path.read_text(encoding="utf-8"))
    items_by_ticker: dict[str, dict[str, Any]] = {}
    for item in raw_items:
        ticker = normalize_ticker(str(item.get("ticker", "")))
        if not ticker or ticker in items_by_ticker:
            continue

        items_by_ticker[ticker] = {
            "ticker": ticker,
            "status": normalize_status(str(item.get("status", "watching"))),
            "tags": normalize_tags(item.get("tags", [])),
        }
    return [items_by_ticker[ticker] for ticker in sorted(items_by_ticker)]


def normalize_ticker(value: str) -> str | None:
    ticker = value.strip().upper()
    if ticker.startswith(("SH", "SZ")):
        ticker = ticker[2:]
    return ticker if len(ticker) == 6 and ticker.isdigit() else None


def normalize_status(value: str) -> str:
    return value if value in {"holding", "watching", "researching", "paused"} else "watching"


def normalize_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    tags: list[str] = []
    for tag in value:
        text = str(tag).strip()
        if text and text not in tags:
            tags.append(text)
    return tags


def sync_from_fixture(tickers: list[str], fixture_path: Path) -> list[dict[str, Any]]:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    synced_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    snapshots: list[dict[str, Any]] = []

    for ticker in tickers:
        row = fixture.get(ticker)
        if not row:
            snapshots.append(failed_snapshot(ticker, "fixture", "fixture 中没有该股票"))
            continue

        snapshots.append(
            {
                "ticker": ticker,
                "name": row.get("name", ticker),
                "price": row.get("price"),
                "dataHealthLabel": "fixture 行情已生成，等待真实接口替换",
                "dataSync": {
                    "state": "sample",
                    "source": "fixture",
                    "lastSyncedAt": synced_at,
                    "detail": "离线样例同步，用于验证同步管道",
                },
            }
        )

    return snapshots


def sync_from_akshare(tickers: list[str]) -> list[dict[str, Any]]:
    try:
        import akshare as ak  # type: ignore
    except ImportError as exc:
        raise SystemExit("AKShare is not installed. Run: pip install akshare") from exc

    synced_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    snapshots: list[dict[str, Any]] = []
    spot = ak.stock_zh_a_spot_em()
    rows_by_code = {str(row["代码"]): row for _, row in spot.iterrows()}

    for ticker in tickers:
        row = rows_by_code.get(ticker)
        if row is None:
            snapshots.append(failed_snapshot(ticker, "AKShare", "东方财富现货行情未返回该股票"))
            continue

        snapshots.append(
            {
                "ticker": ticker,
                "name": str(row.get("名称", ticker)),
                "price": float(row.get("最新价")),
                "dataHealthLabel": "AKShare 东方财富现货行情已更新",
                "dataSync": {
                    "state": "synced",
                    "source": "AKShare",
                    "lastSyncedAt": synced_at,
                    "detail": "东方财富 A 股现货行情已更新，日 K 和结构数据待接入",
                },
            }
        )

    return snapshots


def failed_snapshot(ticker: str, source: str, detail: str) -> dict[str, Any]:
    return {
        "ticker": ticker,
        "dataSync": {
            "state": "failed",
            "source": source,
            "detail": detail,
        },
    }


if __name__ == "__main__":
    main()
