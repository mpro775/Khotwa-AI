"""Computational draft checks do not claim pedagogical approval/publication."""

import json
import unittest
from pathlib import Path

from khotwa_math.engine import analyze, compare


class RoadmapContentTests(unittest.TestCase):
    def test_24_algebra_drafts_have_true_answers_and_distinct_wrong_steps(self):
        path = (
            Path(__file__).resolve().parents[3]
            / "apps/api/data/algebra-expansion.draft.v1.json"
        )
        items = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(len(items), 24)
        self.assertEqual(len({p["lessonCode"] for p in items}), 6)
        for i, item in enumerate(items):
            with self.subTest(item=i):
                a = item["algebra"]
                self.assertEqual(
                    analyze(a["equationRaw"]).solution, analyze(a["answerRaw"]).solution
                )
                self.assertEqual(
                    compare(a["equationRaw"], a["validStepRaw"]).status,
                    "verified_valid",
                )
                self.assertEqual(
                    compare(a["equationRaw"], a["invalidStepRaw"]).status,
                    "verified_invalid",
                )
                self.assertTrue(all(not h["reviewed"] for h in item["hints"]))


if __name__ == "__main__":
    unittest.main()
