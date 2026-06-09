import importlib.util
import json
import types
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "sync_market_data.py"
SPEC = importlib.util.spec_from_file_location("sync_market_data", SCRIPT_PATH)
sync_market_data = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(sync_market_data)


class SyncMarketDataTest(unittest.TestCase):
    def test_default_pool_is_formal_family_pool_file(self):
        self.assertEqual(sync_market_data.DEFAULT_POOL.name, "family-pool.json")

    def test_read_family_pool_items_normalizes_and_preserves_metadata(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            pool_path = Path(temp_dir) / "family-pool.json"
            pool_path.write_text(
                json.dumps(
                    [
                        {
                            "ticker": "sh688041",
                            "status": "holding",
                            "tags": ["AI", "爸爸关注"],
                        },
                        {"ticker": "688041", "status": "watching", "tags": ["重复"]},
                        {"ticker": "bad-code", "status": "watching", "tags": ["忽略"]},
                        {"ticker": "002916"},
                    ],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            items = sync_market_data.read_family_pool_items(pool_path)

        self.assertEqual(
            items,
            [
                {
                    "ticker": "002916",
                    "status": "watching",
                    "tags": [],
                },
                {
                    "ticker": "688041",
                    "status": "holding",
                    "tags": ["AI", "爸爸关注"],
                },
            ],
        )

    def test_select_sync_tickers_prefers_explicit_tickers_over_pool(self):
        pool_items = [
            {"ticker": "002916", "status": "holding", "tags": []},
            {"ticker": "688041", "status": "watching", "tags": []},
        ]

        tickers = sync_market_data.select_sync_tickers(pool_items, "sh688041, bad, 600519")

        self.assertEqual(tickers, ["600519", "688041"])

    def test_fixture_sync_outputs_structure_analysis_from_k_lines(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            fixture_path = Path(temp_dir) / "fixture.json"
            fixture_path.write_text(
                json.dumps(
                    {
                        "688041": {
                            "name": "海光信息",
                            "price": 281.12,
                            "dailyKLines": make_bars(
                                [
                                    20,
                                    21,
                                    22,
                                    23,
                                    24,
                                    25,
                                    26,
                                    25,
                                    24,
                                    25,
                                    26,
                                    27,
                                    28,
                                    29,
                                    30,
                                    31,
                                    32,
                                    33,
                                    34,
                                    35,
                                    36,
                                    37,
                                    38,
                                    39,
                                ]
                            ),
                            "weeklyKLines": make_bars([18, 19, 20, 22, 24, 26, 28, 30]),
                            "hourly60KLines": make_bars(
                                [
                                    28,
                                    29,
                                    30,
                                    31,
                                    32,
                                    31,
                                    30,
                                    31,
                                    32,
                                    33,
                                    34,
                                    35,
                                    36,
                                    35,
                                    36,
                                    37,
                                    38,
                                    39,
                                    40,
                                    41,
                                ]
                            ),
                        }
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            snapshots = sync_market_data.sync_from_fixture(["688041"], fixture_path)

        self.assertEqual(snapshots[0]["ticker"], "688041")
        self.assertEqual(snapshots[0]["dataHealthLabel"], "行情、日线、周线、60 分钟线已更新")
        self.assertEqual(snapshots[0]["decisionInput"]["structureSignal"], "second_buy_candidate")
        self.assertEqual(snapshots[0]["structureAnalysis"]["buyPointLabel"], "二买候选")
        self.assertIn("中枢", snapshots[0]["structureAnalysis"]["summary"])

    def test_akshare_provider_returns_failed_snapshots_when_spot_fetch_fails(self):
        fake_akshare = types.SimpleNamespace(
            stock_zh_a_spot_em=lambda: (_ for _ in ()).throw(RuntimeError("proxy down"))
        )

        with patch.dict("sys.modules", {"akshare": fake_akshare}):
            snapshots = sync_market_data.sync_from_akshare(["688041", "600519"])

        self.assertEqual([snapshot["ticker"] for snapshot in snapshots], ["688041", "600519"])
        self.assertEqual(snapshots[0]["dataSync"]["state"], "failed")
        self.assertEqual(snapshots[0]["dataSync"]["source"], "AKShare")
        self.assertIn("proxy down", snapshots[0]["dataSync"]["detail"])
        self.assertEqual(snapshots[0]["decisionInput"]["dataHealth"], "missing")
        self.assertIsNone(snapshots[0]["structureAnalysis"])


def make_bars(closes):
    return [
        {
            "date": f"2026-05-{index + 1:02d}",
            "open": close - 1,
            "high": close + 2,
            "low": close - 2,
            "close": close,
            "volume": 1000 + index,
        }
        for index, close in enumerate(closes)
    ]


if __name__ == "__main__":
    unittest.main()
