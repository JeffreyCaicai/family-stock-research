import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


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


if __name__ == "__main__":
    unittest.main()
