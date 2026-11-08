"""B1 fixtures use the existing algebra verdict, not a second lab parser."""

import json
import unittest
from pathlib import Path

from helpers import payload
from khotwa_math.protocol import execute, validate_request
from stem_math_oracle import points

FIXTURE = (
    Path(__file__).resolve().parents[3] / "apps/api/tests/fixtures/stem-math.v1.json"
)


class StemMathTests(unittest.TestCase):
    def test_existing_verifier_confirms_lab_transitions(self):
        fixtures = json.loads(FIXTURE.read_text(encoding="utf-8"))
        for item in fixtures["transitions"]:
            with self.subTest(item=item):
                data = payload("verify-transition", item["from"], item["to"])
                result = execute(validate_request("verify-transition", data))
                self.assertEqual(result["status"], item["status"])
                if result["status"] == "verified_invalid":
                    self.assertEqual(result["evidence"]["type"], "counterexample")
                    witness = result["evidence"]["witness"]
                    self.assertNotEqual(
                        witness["satisfiesPrevious"], witness["satisfiesNext"]
                    )

    def test_all_authored_correct_methods_are_complete(self):
        fixtures = json.loads(FIXTURE.read_text(encoding="utf-8"))
        spec = fixtures["activities"][1]
        for method in spec["methods"]:
            data = payload("check-final", spec["originalRaw"], method["steps"][-1])
            result = execute(validate_request("check-final", data))
            self.assertEqual(result["status"], "verified_valid")
            self.assertTrue(result["isIsolated"])
            self.assertTrue(result["substitutionValid"])

    def test_unsupported_language_is_not_a_false_invalid_transition(self):
        for value in ("جا(س)=١", "x=1", "س*س=١", "س/س=١"):
            data = payload("verify-transition", "س=١", value)
            result = execute(validate_request("verify-transition", data))
            self.assertEqual(result["status"], "unsupported")
            self.assertIsNone(result["evidence"])

    def test_exact_graph_oracle_handles_negative_zero_and_decimal_values(self):
        fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
        data = [points(model) for model in fixture["graphModels"]]
        self.assertEqual(
            data[0],
            [
                {"x": -1.0, "y": -1.0},
                {"x": 0.0, "y": 1.0},
                {"x": 1.0, "y": 3.0},
            ],
        )
        self.assertTrue(all(point["y"] == 3 for point in data[1]))
        self.assertEqual(data[4][13], {"x": 0.3, "y": 0.23})
        self.assertEqual(len(data[5]), 101)

    def test_fixtures_are_synthetic_drafts_not_published_content(self):
        fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
        self.assertTrue(fixture["synthetic"])
        self.assertEqual(fixture["reviewStatus"], "draft")
        self.assertEqual(len(fixture["activities"]), 6)


if __name__ == "__main__":
    unittest.main()
