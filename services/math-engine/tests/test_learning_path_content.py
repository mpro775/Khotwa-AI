"""V2.2 authored examples: deterministic checks, never pedagogical approval."""

import json
from pathlib import Path
import unittest

from khotwa_math.engine import analyze, compare
from khotwa_math.physics import verify_physics


class LearningPathContentTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[3]
        self.rows = json.loads(
            (root / "apps/api/data/learning-paths.draft.v1.json").read_text(
                encoding="utf-8"
            )
        )

    def test_examples_use_exact_equivalent_transitions(self):
        examples = 0
        transitions = 0
        for lesson in self.rows:
            for block in lesson.get("contentBlocks", []):
                if block["type"] not in {"math_example", "worked_steps"}:
                    continue
                examples += 1
                previous = block["raw"]
                analyze(previous)
                for step in block["steps"]:
                    with self.subTest(lesson=lesson["code"], step=step["raw"]):
                        self.assertEqual(
                            compare(previous, step["raw"]).status,
                            "verified_valid",
                        )
                    previous = step["raw"]
                    transitions += 1
        self.assertEqual(examples, 7)
        self.assertEqual(transitions, 17)

    def test_physics_example_matches_value_unit_and_givens(self):
        blocks = [
            block
            for lesson in self.rows
            for block in lesson.get("contentBlocks", [])
            if block["type"] == "physics_example"
        ]
        self.assertEqual(len(blocks), 1)
        result = verify_physics(
            {
                "contractVersion": "physics-internal-v1",
                "operation": "validate_reference",
                "problemRevisionId": "v22-draft-physics-example",
                "reference": blocks[0]["physics"],
            }
        )
        self.assertEqual(result["status"], "correct", result)

    def test_bundle_stays_draft_without_fabricated_reviews(self):
        self.assertEqual(len(self.rows), 21)
        for row in self.rows:
            self.assertNotIn("reviewedBy", row)
            self.assertNotIn("publishedAt", row)
            if row["kind"] == "lesson":
                self.assertEqual(row["practiceProblemRevisionIds"], [])
                self.assertEqual(row["assessmentProblemRevisionIds"], [])
                self.assertNotIn("SK-ALG-08", row["skillCodes"])


if __name__ == "__main__":
    unittest.main()
