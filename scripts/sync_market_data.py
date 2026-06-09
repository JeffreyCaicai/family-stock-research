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
    parser.add_argument(
        "--tickers",
        default="",
        help="Comma or whitespace separated tickers. When set, sync these instead of the pool file.",
    )
    args = parser.parse_args()

    pool_items = read_family_pool_items(Path(args.pool))
    tickers = select_sync_tickers(pool_items, args.tickers)
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


def select_sync_tickers(pool_items: list[dict[str, Any]], explicit_tickers: str = "") -> list[str]:
    raw_values = (
        explicit_tickers.replace(",", " ").replace("，", " ").split()
        if explicit_tickers.strip()
        else [str(item.get("ticker", "")) for item in pool_items]
    )
    tickers = {ticker for value in raw_values if (ticker := normalize_ticker(value))}
    return sorted(tickers)


def sync_from_fixture(tickers: list[str], fixture_path: Path) -> list[dict[str, Any]]:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    synced_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    snapshots: list[dict[str, Any]] = []

    for ticker in tickers:
        row = fixture.get(ticker)
        if not row:
            snapshots.append(failed_snapshot(ticker, "fixture", "fixture 中没有该股票"))
            continue

        snapshots.append(build_snapshot(ticker, row, "fixture", "sample", synced_at))

    return snapshots


def sync_from_akshare(tickers: list[str]) -> list[dict[str, Any]]:
    try:
        import akshare as ak  # type: ignore
    except ImportError as exc:
        raise SystemExit("AKShare is not installed. Run: pip install akshare") from exc

    synced_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    snapshots: list[dict[str, Any]] = []
    try:
        spot = ak.stock_zh_a_spot_em()
    except Exception as exc:
        detail = f"AKShare 东方财富行情源连接失败：{exc}"
        return [failed_snapshot(ticker, "AKShare", detail, synced_at) for ticker in tickers]

    rows_by_code = {str(row["代码"]): row for _, row in spot.iterrows()}

    for ticker in tickers:
        row = rows_by_code.get(ticker)
        if row is None:
            snapshots.append(
                failed_snapshot(ticker, "AKShare", "东方财富现货行情未返回该股票", synced_at)
            )
            continue

        market_row = {
            "name": str(row.get("名称", ticker)),
            "price": float(row.get("最新价")),
            **fetch_akshare_k_lines(ak, ticker),
        }
        snapshots.append(build_snapshot(ticker, market_row, "AKShare", "synced", synced_at))

    return snapshots


def failed_snapshot(
    ticker: str,
    source: str,
    detail: str,
    synced_at: str | None = None,
) -> dict[str, Any]:
    return {
        "ticker": ticker,
        "dataHealthLabel": f"{source} 真实数据同步失败，不能下操作结论",
        "dataSync": {
            "state": "failed",
            "source": source,
            "detail": detail,
            **({"lastSyncedAt": synced_at} if synced_at else {}),
        },
        "decisionInput": {
            "dataHealth": "missing",
            "riskFlags": ["真实数据同步失败"],
            "trend": "range",
            "structureSignal": "none",
        },
        "structureAnalysis": None,
    }


def build_snapshot(
    ticker: str,
    row: dict[str, Any],
    source: str,
    state: str,
    synced_at: str,
) -> dict[str, Any]:
    daily = normalize_k_lines(row.get("dailyKLines", []))
    weekly = normalize_k_lines(row.get("weeklyKLines", []))
    hourly60 = normalize_k_lines(row.get("hourly60KLines", []))
    structure = analyze_structure(daily, weekly, hourly60)
    has_structure = structure["dataHealth"] == "ready"

    snapshot: dict[str, Any] = {
        "ticker": ticker,
        "name": row.get("name", ticker),
        "price": row.get("price"),
        "dataHealthLabel": (
            "行情、日线、周线、60 分钟线已更新"
            if has_structure
            else f"{source} 行情已更新，K 线结构数据待补齐"
        ),
        "dataSync": {
            "state": state,
            "source": source,
            "lastSyncedAt": synced_at,
            "detail": (
                "行情、日线、周线、60 分钟线已更新并生成结构摘要"
                if has_structure
                else "行情已更新，日 K、周 K、60 分钟 K 仍需补齐"
            ),
        },
    }

    if has_structure:
        snapshot["decisionInput"] = structure["decisionInput"]
        snapshot["structureAnalysis"] = structure

    return snapshot


def fetch_akshare_k_lines(ak: Any, ticker: str) -> dict[str, Any]:
    try:
        daily = ak.stock_zh_a_hist(symbol=ticker, period="daily", adjust="qfq")
        weekly = ak.stock_zh_a_hist(symbol=ticker, period="weekly", adjust="qfq")
        hourly60 = ak.stock_zh_a_hist_min_em(symbol=market_symbol(ticker), period="60", adjust="qfq")
    except Exception:
        return {
            "dailyKLines": [],
            "weeklyKLines": [],
            "hourly60KLines": [],
        }

    return {
        "dailyKLines": dataframe_to_k_lines(daily),
        "weeklyKLines": dataframe_to_k_lines(weekly),
        "hourly60KLines": dataframe_to_k_lines(hourly60),
    }


def market_symbol(ticker: str) -> str:
    return f"sh{ticker}" if ticker.startswith(("6", "9")) else f"sz{ticker}"


def dataframe_to_k_lines(frame: Any) -> list[dict[str, Any]]:
    records = frame.tail(160).to_dict("records")
    bars: list[dict[str, Any]] = []
    for record in records:
        bar = normalize_k_line(record)
        if bar:
            bars.append(bar)
    return bars


def normalize_k_lines(value: Any) -> list[dict[str, float | str]]:
    if not isinstance(value, list):
        return []

    bars: list[dict[str, float | str]] = []
    for raw_bar in value:
        bar = normalize_k_line(raw_bar)
        if bar:
            bars.append(bar)
    return sorted(bars, key=lambda item: str(item["date"]))


def normalize_k_line(value: Any) -> dict[str, float | str] | None:
    if not isinstance(value, dict):
        return None

    date = value.get("date") or value.get("日期") or value.get("时间")
    open_price = value.get("open", value.get("开盘"))
    high = value.get("high", value.get("最高"))
    low = value.get("low", value.get("最低"))
    close = value.get("close", value.get("收盘"))
    volume = value.get("volume", value.get("成交量", 0))

    try:
        return {
            "date": str(date),
            "open": float(open_price),
            "high": float(high),
            "low": float(low),
            "close": float(close),
            "volume": float(volume),
        }
    except (TypeError, ValueError):
        return None


def analyze_structure(
    daily: list[dict[str, float | str]],
    weekly: list[dict[str, float | str]],
    hourly60: list[dict[str, float | str]],
) -> dict[str, Any]:
    data_health = "ready" if len(daily) >= 20 and len(weekly) >= 8 and len(hourly60) >= 20 else "missing"
    if data_health != "ready":
        return {
            "buyPointLabel": "无买点",
            "dataHealth": data_health,
            "decisionInput": {
                "dataHealth": data_health,
                "riskFlags": [],
                "trend": "range",
                "structureSignal": "none",
            },
            "keyLevels": {},
            "levelSummary": {
                "daily": f"{len(daily)} 根日 K",
                "hourly60": f"{len(hourly60)} 根 60 分钟 K",
                "weekly": f"{len(weekly)} 根周 K",
            },
            "riskFlags": [],
            "sellPointLabel": "无风险卖点",
            "structureSignal": "none",
            "summary": "K 线不足，先补齐日线、周线和 60 分钟线后再判断结构。",
            "trend": "range",
        }

    latest_close = float(daily[-1]["close"])
    daily_ma5 = moving_average(daily, 5)
    daily_ma20 = moving_average(daily, 20)
    hourly_ma10 = moving_average(hourly60, 10)
    trend = derive_trend(latest_close, daily_ma5, daily_ma20)
    center_range = derive_center_range(daily)
    support = min(float(bar["low"]) for bar in daily[-20:])
    resistance = max(float(bar["high"]) for bar in daily[-20:-1])
    risk_flags = (
        ["跌破近期结构防守位"]
        if latest_close <= support * 1.03 or (trend == "down" and latest_close < daily_ma20)
        else []
    )
    structure_signal = derive_structure_signal(
        center_range,
        hourly60,
        hourly_ma10,
        latest_close,
        resistance,
        risk_flags,
        trend,
        weekly,
    )

    return {
        "buyPointLabel": buy_point_label_for(structure_signal),
        "centerRange": center_range,
        "dataHealth": data_health,
        "decisionInput": {
            "dataHealth": data_health,
            "riskFlags": risk_flags,
            "trend": trend,
            "structureSignal": structure_signal,
        },
        "keyLevels": {
            "resistance": round_number(resistance),
            "risk": round_number(support),
            "support": round_number(support),
        },
        "levelSummary": {
            "daily": daily_summary(trend, center_range, latest_close),
            "hourly60": "60 分钟站上短均线" if float(hourly60[-1]["close"]) > hourly_ma10 else "60 分钟仍在短均线下方",
            "weekly": "周线保持修复" if float(weekly[-1]["close"]) >= moving_average(weekly, 5) else "周线仍需修复",
        },
        "riskFlags": risk_flags,
        "sellPointLabel": "风险卖点候选" if structure_signal == "risk_sell_candidate" else "无风险卖点",
        "structureSignal": structure_signal,
        "summary": summary_for(structure_signal, center_range),
        "trend": trend,
    }


def derive_trend(close: float, ma5: float, ma20: float) -> str:
    if close >= ma5 >= ma20:
        return "up"
    if close <= ma5 <= ma20:
        return "down"
    return "range"


def derive_center_range(bars: list[dict[str, float | str]]) -> dict[str, float]:
    recent = bars[-12:]
    lows = sorted(float(bar["low"]) for bar in recent)
    highs = sorted(float(bar["high"]) for bar in recent)
    return {
        "high": round_number(highs[min(len(highs) - 1, int(len(highs) * 0.65))]),
        "low": round_number(lows[min(len(lows) - 1, int(len(lows) * 0.35))]),
    }


def derive_structure_signal(
    center_range: dict[str, float],
    hourly60: list[dict[str, float | str]],
    hourly_ma10: float,
    latest_close: float,
    resistance: float,
    risk_flags: list[str],
    trend: str,
    weekly: list[dict[str, float | str]],
) -> str:
    if risk_flags:
        return "risk_sell_candidate"

    weekly_repairing = float(weekly[-1]["close"]) >= moving_average(weekly, 5)
    hourly_confirming = float(hourly60[-1]["close"]) > hourly_ma10
    if trend == "up" and weekly_repairing and hourly_confirming and latest_close > center_range["high"]:
        return "second_buy_confirmed" if latest_close > resistance else "second_buy_candidate"

    if trend != "down" and hourly_confirming and latest_close >= center_range["low"]:
        return "second_buy_candidate"

    return "none"


def buy_point_label_for(signal: str) -> str:
    if signal == "second_buy_confirmed":
        return "二买确认"
    if signal == "second_buy_candidate":
        return "二买候选"
    return "无买点"


def daily_summary(trend: str, center_range: dict[str, float], latest_close: float) -> str:
    if latest_close > center_range["high"]:
        return f"日线站上中枢上沿 {center_range['high']}"
    if latest_close < center_range["low"]:
        return f"日线跌破中枢下沿 {center_range['low']}"
    return "日线趋势向上，仍在中枢内震荡" if trend == "up" else "日线处于中枢震荡"


def summary_for(signal: str, center_range: dict[str, float]) -> str:
    if signal == "second_buy_confirmed":
        return f"价格突破中枢上沿 {center_range['high']}，二买结构已确认，仍需人工复核赔率。"
    if signal == "second_buy_candidate":
        return f"价格围绕中枢 {center_range['low']}-{center_range['high']} 修复，二买候选出现，等待小级别确认。"
    if signal == "risk_sell_candidate":
        return "价格跌破中枢或近期防守位，出现风险卖点候选，先控制回撤。"
    return f"结构未给出明确买点，继续观察中枢 {center_range['low']}-{center_range['high']} 的方向选择。"


def moving_average(bars: list[dict[str, float | str]], window_size: int) -> float:
    window = bars[-window_size:]
    return sum(float(bar["close"]) for bar in window) / len(window)


def round_number(value: float) -> float:
    return round(value, 2)


if __name__ == "__main__":
    main()
