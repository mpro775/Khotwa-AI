"""Small, deterministic physics tests. No service, network or environment start."""

import copy
import json
import unittest
from pathlib import Path

from khotwa_math.physics import verify_physics
from khotwa_math.engine import analyze


def request(value="14", unit="m/s"):
    return {
        "contractVersion": "physics-internal-v1",
        "operation": "check_answer",
        "problemRevisionId": "physics-example-v1",
        "reference": {
            "topic": "kinematics_1d",
            "formula": "final_velocity",
            "quantity": "velocity",
            "expectedDimension": "speed",
            "expectedValueSI": "14",
            "expectedUnit": "m/s",
            "tolerance": "0",
            "givens": {"v0": "2", "a": "3", "t": "4"},
        },
        "answer": {"value": value, "unit": unit},
    }


class PhysicsTests(unittest.TestCase):
    def test_valid_and_wrong_values_and_units(self):
        cases = [
            ("14", "m/s", "correct"),
            ("١٤", "m/s", "correct"),
            ("14.0", "m/s", "correct"),
            ("28/2", "m/s", "correct"),
            ("10", "m/s", "wrong_value"),
            ("-14", "m/s", "wrong_value"),
            ("−١٤", "m/s", "wrong_value"),
            ("14", "m", "wrong_unit"),
            ("14", "s", "wrong_unit"),
            ("14", "m/s²", "wrong_unit"),
            ("14", "", "wrong_unit"),
            ("14", "kg", "wrong_unit"),
            ("50.4", "km/h", "correct"),
            ("٥٠٫٤", "km/h", "correct"),
            ("14", "km/h", "wrong_value"),
            ("0", "m/s", "wrong_value"),
        ]
        for value, unit, status in cases:
            with self.subTest(value=value, unit=unit):
                self.assertEqual(verify_physics(request(value, unit))["status"], status)

    def test_untrusted_numeric_language_is_bounded(self):
        for value in [
            "__import__('os')",
            "1+13",
            "1e50000",
            "nan",
            "inf",
            "1/0",
            "9" * 1000,
            "14\u202e",
            "١٤٫",
            " 14",
            "14 ",
            "1.0000001",
            "14/0",
            "1/2/3",
        ]:
            with self.subTest(value=value[:20]):
                self.assertEqual(
                    verify_physics(request(value))["status"], "invalid_input"
                )

    def test_schema_and_reference_guards(self):
        cases = []
        for field, value in [
            ("contractVersion", "other"),
            ("operation", "execute"),
            ("problemRevisionId", "../secret"),
        ]:
            p = request()
            p[field] = value
            cases.append(p)
        p = request()
        p["secret"] = 1
        cases.append(p)
        p = request()
        p["answer"]["extra"] = 1
        cases.append(p)
        for field, value in [
            ("expectedValueSI", "15"),
            ("tolerance", "-1"),
            ("tolerance", "1"),
            ("expectedUnit", "m"),
            ("expectedDimension", "length"),
            ("quantity", "distance"),
            ("formula", "eval"),
        ]:
            p = request()
            p["reference"][field] = value
            cases.append(p)
        p = request()
        p["reference"]["givens"]["t"] = "-1"
        cases.append(p)
        p = request()
        p["reference"]["givens"]["unknown"] = "1"
        cases.append(p)
        for p in cases:
            with self.subTest(payload=p):
                self.assertIn(
                    verify_physics(p)["status"], ["invalid_input", "unsupported"]
                )

    def test_diagnostics_are_evidence_based(self):
        unit = verify_physics(request("14", "m"))
        self.assertTrue(unit["valueCorrect"])
        self.assertFalse(unit["unitCorrect"])
        self.assertEqual(unit["diagnosisCode"], "speed_distance_confusion")
        self.assertEqual(
            verify_physics(request("14", "km/h"))["diagnosisCode"], "unit_conversion"
        )
        self.assertEqual(
            verify_physics(request("-14"))["diagnosisCode"], "sign_or_acceleration"
        )
        self.assertIsNone(verify_physics(request("10"))["diagnosisCode"])

    def test_rounding_is_explicit_and_reference_is_exact(self):
        p = request("4.67")
        p["reference"].update(
            formula="average_speed",
            quantity="speed",
            expectedValueSI="14/3",
            tolerance="0.01",
            givens={"d": "14", "t": "3"},
        )
        self.assertEqual(verify_physics(p)["status"], "correct")
        p["answer"]["value"] = "4.68"
        self.assertEqual(verify_physics(p)["status"], "wrong_value")
        p["reference"]["expectedValueSI"] = "4.67"
        self.assertEqual(verify_physics(p)["reasonCode"], "REFERENCE_VALUE_MISMATCH")

    def test_acceleration_alias_and_negative_displacement(self):
        p = request("-2", "m/s^2")
        p["reference"].update(
            formula="acceleration",
            quantity="acceleration",
            expectedDimension="acceleration",
            expectedValueSI="-2",
            expectedUnit="m/s²",
            givens={"v": "4", "v0": "16", "t": "6"},
        )
        self.assertEqual(verify_physics(p)["status"], "correct")
        p["reference"].update(
            formula="constant_velocity_displacement",
            quantity="displacement",
            expectedDimension="length",
            expectedValueSI="-12",
            expectedUnit="m",
            givens={"v": "-4", "t": "3"},
        )
        p["answer"] = {"value": "-12", "unit": "m"}
        self.assertEqual(verify_physics(p)["status"], "correct")

    def test_all_draft_references_are_computationally_consistent(self):
        path = (
            Path(__file__).resolve().parents[3]
            / "apps/api/data/physics-kinematics.draft.v1.json"
        )
        items = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(len(items), 20)
        self.assertEqual(len({p["lessonCode"] for p in items}), 6)
        for i, item in enumerate(items):
            with self.subTest(item=i):
                p = request()
                p["operation"] = "validate_reference"
                del p["answer"]
                p["reference"] = copy.deepcopy(item["physics"])
                self.assertEqual(verify_physics(p)["status"], "correct")
                self.assertTrue(all(not h["reviewed"] for h in item["hints"]))

    def test_old_algebra_engine_remains_separate(self):
        self.assertEqual(str(analyze("٢س + ٣ = ٧").solution.value), "2")
        self.assertNotIn("reference", verify_physics(request()))
        self.assertNotIn("expectedValueSI", verify_physics(request()))


if __name__ == "__main__":
    unittest.main()
