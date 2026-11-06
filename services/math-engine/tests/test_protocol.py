import copy
import unittest
from unittest.mock import patch

from helpers import REQUEST_ID, STEP_ID, payload
from khotwa_math import ENGINE_VERSION, NOTATION_VERSION
from khotwa_math.__main__ import strict_json
from khotwa_math.protocol import ContractError, execute, validate_request


class ProtocolTests(unittest.TestCase):
    def test_echoes_versions_context_source_and_revision(self) -> None:
        for operation in ("parse", "verify-transition", "check-final"):
            request = payload(operation)
            original = copy.deepcopy(request)
            result = execute(validate_request(operation, request))
            self.assertEqual(request, original)
            self.assertEqual(result["requestId"], REQUEST_ID)
            self.assertEqual(result["engineVersion"], ENGINE_VERSION)
            self.assertEqual(result["notationProfileVersion"], NOTATION_VERSION)
            if operation == "verify-transition":
                self.assertEqual(result["attemptRevision"], 4)
            else:
                self.assertEqual(result["context"], request["context"])
            if operation == "parse":
                self.assertEqual(result["source"], request["source"])
                self.assertEqual(result["ast"]["sourceRaw"], "٢س=٤")

    def test_check_final_does_not_decide_completion(self) -> None:
        cases = [
            ("س=٢", "verified_valid", True, True),
            ("٢=س", "verified_valid", True, True),
            ("٢س=٤", "verified_valid", False, None),
            ("س=٣", "verified_invalid", True, False),
        ]
        for final, status, is_isolated, valid in cases:
            result = execute(
                validate_request("check-final", payload("check-final", new=final))
            )
            self.assertEqual(result["status"], status)
            self.assertEqual(result["isIsolated"], is_isolated)
            self.assertEqual(result["substitutionValid"], valid)
            self.assertEqual(result["finalStepVersionId"], STEP_ID)
            for forbidden in ("completed", "mastery", "independence", "diagnosis"):
                self.assertNotIn(forbidden, result)

    def test_abstentions_have_no_partial_success_fields(self) -> None:
        for final in ("س=", "س/س=١", "س=١" + ("/" + "٩" * 18) * 5):
            result = execute(
                validate_request("check-final", payload("check-final", new=final))
            )
            self.assertIn(
                result["status"], ("syntax_error", "unsupported", "inconclusive")
            )
            for key in (
                "isIsolated",
                "substitutionValid",
                "solution",
                "originalSolution",
                "finalSolution",
                "evidence",
            ):
                self.assertIsNone(result[key])

    def test_client_ast_extra_fields_and_unknown_schema_rejected(self) -> None:
        for extra in (
            {"ast": {}},
            {"isCorrect": True},
            {"limits": {"timeout": 999999}},
        ):
            data = payload("parse")
            data.update(extra)
            with self.assertRaises(ContractError):
                validate_request("parse", data)
        data = payload("parse")
        data["schemaVersion"] = "math-internal-v99"
        with self.assertRaisesRegex(ContractError, "schema_version_mismatch"):
            validate_request("parse", data)

    def test_wrong_types_bounds_uuid_and_source_consistency(self) -> None:
        for revision in (True, -1, "4", 2147483648):
            data = payload("parse")
            data["context"]["attemptRevision"] = revision
            with self.assertRaises(ContractError):
                validate_request("parse", data)
        for operation in ("parse", "verify-transition", "check-final"):
            data = payload(operation)
            data["requestId"] = "not-a-uuid"
            with self.assertRaises(ContractError):
                validate_request(operation, data)
        data = payload("parse")
        data["source"] = {"kind": "problem", "stepVersionId": STEP_ID}
        with self.assertRaises(ContractError):
            validate_request("parse", data)
        data = payload("verify-transition")
        data["transition"]["fromStepVersionId"] = STEP_ID
        with self.assertRaises(ContractError):
            validate_request("verify-transition", data)
        for raw in ("", "س" * 257, 3, None):
            data = payload("parse")
            data["raw"] = raw
            with self.assertRaises(ContractError):
                validate_request("parse", data)

    def test_unknown_profile_fails_closed_with_original_context(self) -> None:
        data = payload("parse")
        data["context"]["notationProfile"] = "unrecognized"
        result = execute(validate_request("parse", data))
        self.assertEqual(result["parseStatus"], "service_error")
        self.assertEqual(result["context"], data["context"])
        self.assertIsNone(result["ast"])

    def test_json_duplicate_keys_floats_constants_and_invalid_utf8_rejected(
        self,
    ) -> None:
        for value in (b'{"a":1,"a":2}', b'{"a":1.5}', b'{"a":NaN}', b'"\xff"'):
            with self.assertRaises((ValueError, UnicodeError)):
                strict_json(value)

    def test_technical_failure_is_sanitized(self) -> None:
        with patch("khotwa_math.engine.analyze", side_effect=MemoryError("secret")):
            result = execute(validate_request("parse", payload("parse")))
        self.assertEqual(result["parseStatus"], "service_error")
        self.assertIsNone(result["ast"])
        self.assertNotIn("secret", str(result))
