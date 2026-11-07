"""Local reference checks for authored drafts; no publication or HTTP calls."""

import json
from pathlib import Path
import unittest

from khotwa_math.physics import verify_physics


class PhysicsLearningContentTests(unittest.TestCase):
    def test_twelve_practice_transfer_drafts_have_exact_references(self):
        root = Path(__file__).resolve().parents[3]
        path = root / "apps/api/data/physics-learning.draft.v1.json"
        rows = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(len(rows), 12)
        self.assertEqual(len({p["lessonCode"] for p in rows}), 6)
        for index, payload in enumerate(rows):
            with self.subTest(index=index, kind=payload["kind"]):
                self.assertIn(payload["kind"], {"remediation", "transfer"})
                self.assertTrue(all(not h["reviewed"] for h in payload["hints"]))
                result = verify_physics(
                    {
                        "contractVersion": "physics-internal-v1",
                        "operation": "validate_reference",
                        "problemRevisionId": "draft-" + str(index),
                        "reference": payload["physics"],
                    }
                )
                self.assertEqual(result["status"], "correct", result)
