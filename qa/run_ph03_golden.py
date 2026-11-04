"""Execute draft parse/math development cases without modifying the reference."""

import hashlib
import json
import sys
from datetime import datetime, timezone, timedelta
from fractions import Fraction
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/math-engine/tests"))
from helpers import payload  # noqa: E402
from khotwa_math.engine import analyze  # noqa: E402
from khotwa_math.protocol import execute, validate_request  # noqa: E402

TRANSLATE = str.maketrans("٠١٢٣٤٥٦٧٨٩−", "0123456789-")


def expected_set(text: str) -> tuple[str, Fraction | None]:
    if text in ("ℝ", "∅"):
        return ("all_reals" if text == "ℝ" else "empty", None)
    return "singleton", Fraction(text.strip("{}").translate(TRANSLATE))


def actual_set(value: object) -> tuple[str, Fraction | None]:
    assert isinstance(value, dict)
    if value["kind"] != "singleton":
        return value["kind"], None
    number = value["value"]
    return "singleton", Fraction(int(number["num"]), int(number["den"]))


def member(solution: tuple[str, Fraction | None], value: Fraction) -> bool:
    return (
        solution[0] == "all_reals"
        or solution[0] == "singleton"
        and solution[1] == value
    )


def main() -> None:
    data_path = ROOT / "docs/14-GOLDEN-DATASET.cases.json"
    source = data_path.read_bytes()
    dataset = json.loads(source)
    cases = []
    contracts = []
    for case in dataset["parse"]:
        raw = case["raw"]
        if case["id"] in ("GOLD-PARSE-039", "GOLD-PARSE-040"):
            raw = raw.replace("[U+202E]", "\u202e").replace("[U+2066]", "\u2066")
        request = payload("parse", old=raw)
        result = execute(validate_request("parse", request))
        expected_status = "parsed" if case["status"] == "accepted" else case["status"]
        expected_reason = None if case["reason"] == "—" else case["reason"]
        passed = (
            result["parseStatus"] == expected_status
            and result["reasonCode"] == expected_reason
        )
        round_trip = None
        if result["parseStatus"] == "parsed":
            parsed = analyze(raw)
            round_trip = all(
                analyze(text).linear == parsed.linear
                for text in (parsed.display, parsed.normalized)
            )
            passed = passed and round_trip and result["ast"]["sourceRaw"] == raw
        cases.append(
            {
                "id": case["id"],
                "inputRawExecuted": raw,
                "expectedStatus": expected_status,
                "expectedReason": expected_reason,
                "actual": result,
                "passed": bool(passed),
                "roundTrip": round_trip,
            }
        )
        contracts.append(
            {
                "requestSchema": "InternalMathParseRequest",
                "request": request,
                "responseSchema": "InternalMathParseResult",
                "response": result,
            }
        )
    for case in dataset["math"]:
        request = payload("verify-transition", case["before"], case["after"])
        result = execute(validate_request("verify-transition", request))
        passed = result["status"] == case["status"]
        evidence = result["evidence"]
        witness_valid = None
        reference_witness_valid = None
        if isinstance(evidence, dict):
            old, new = expected_set(case["before_set"]), expected_set(case["after_set"])
            passed = (
                passed
                and actual_set(evidence["previousSolution"]) == old
                and actual_set(evidence["nextSolution"]) == new
            )
            if result["status"] == "verified_invalid":
                witness = evidence["witness"]
                if not isinstance(witness, dict):
                    passed = False
                else:
                    number = witness["value"]
                    value = Fraction(int(number["num"]), int(number["den"]))
                    witness_valid = (
                        member(old, value) != member(new, value)
                        and witness["satisfiesPrevious"] == member(old, value)
                        and witness["satisfiesNext"] == member(new, value)
                    )
                    passed = passed and witness_valid
                reference_value = Fraction(case["witness"].translate(TRANSLATE))
                reference_witness_valid = member(old, reference_value) != member(
                    new, reference_value
                )
                passed = passed and reference_witness_valid
        else:
            passed = False
        cases.append(
            {
                "id": case["id"],
                "expectedStatus": case["status"],
                "actual": result,
                "passed": bool(passed),
                "witnessValidatedIndependentlyFromExpectedSets": witness_valid,
                "goldenWitnessValidated": reference_witness_valid,
            }
        )
        contracts.append(
            {
                "requestSchema": "InternalMathTransitionRequest",
                "request": request,
                "responseSchema": "InternalMathTransitionResult",
                "response": result,
            }
        )
    for old, final in (
        ("٢س=٤", "س=٢"),
        ("٢س=٤", "٢=س"),
        ("٢س=٤", "٢س=٤"),
        ("٢س=٤", "س=٣"),
        ("٢س=٤", "س/س=١"),
        ("٢س=٤", "س="),
    ):
        request = payload("check-final", old, final)
        result = execute(validate_request("check-final", request))
        contracts.append(
            {
                "requestSchema": "InternalMathCheckFinalRequest",
                "request": request,
                "responseSchema": "InternalMathCheckFinalResult",
                "response": result,
            }
        )
    # Contract examples for technical and inconclusive states absent from Golden.
    for operation in ("parse", "verify-transition", "check-final"):
        request = payload(operation, "س=١" + ("/" + "٩" * 18) * 5)
        result = execute(validate_request(operation, request))
        schema = {
            "parse": "InternalMathParse",
            "verify-transition": "InternalMathTransition",
            "check-final": "InternalMathCheckFinal",
        }[operation]
        contracts.append(
            {
                "requestSchema": schema + "Request",
                "request": request,
                "responseSchema": schema + "Result",
                "response": result,
            }
        )
        with patch(
            "khotwa_math.engine.analyze",
            side_effect=RuntimeError("synthetic-internal-failure"),
        ):
            result = execute(validate_request(operation, payload(operation)))
        contracts.append(
            {
                "requestSchema": schema + "Request",
                "request": payload(operation),
                "responseSchema": schema + "Result",
                "response": result,
            }
        )
    report = {
        "phase": "PH-03",
        "recordedAtRiyadh": datetime.now(timezone(timedelta(hours=3))).isoformat(),
        "datasetSha256": hashlib.sha256(source).hexdigest(),
        "datasetVersion": dataset["dataset_version"],
        "subjectReview": "unreviewed_not_changed",
        "scope": "97 draft development cases only; not 151-case acceptance or GATE-1",
        "passed": sum(c["passed"] for c in cases),
        "failed": sum(not c["passed"] for c in cases),
        "groupsNotRun": ["diagnosis", "tutoring", "state"],
        "cases": cases,
    }
    (ROOT / "qa-reports/ph03-golden-results.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (ROOT / "qa-reports/ph03-contract-fixtures.json").write_text(
        json.dumps(contracts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    assert data_path.read_bytes() == source
    print(
        f"Draft Golden: {report['passed']}/97 passed; {report['failed']} failed; "
        "no review status changed"
    )
    if report["failed"]:
        for case in cases:
            if not case["passed"]:
                print(case["id"], case["actual"])
        raise SystemExit(1)


if __name__ == "__main__":
    main()
