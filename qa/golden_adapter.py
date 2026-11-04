"""PH-00 fixture-to-expectation adapter; no parser, service, or mathematical verdicts.

Source records and expected outcomes are preserved. Outputs are test expectations,
never requests to the public API and never product test results.
"""
from pathlib import Path
import argparse
import copy
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
GROUPS = ("parse", "math", "diagnosis", "tutoring", "state")
PARSE_STATUS = {"accepted": "parsed", "syntax_error": "syntax_error", "unsupported": "unsupported"}


def validate_fixtures(data):
    from jsonschema import Draft202012Validator, FormatChecker
    schema = json.loads((ROOT / "docs/contracts/golden-fixtures-v1.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(data)
    ids = [case["id"] for group in (*GROUPS, "seed_problems") for case in data[group]]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate fixture identifier")
    math_ids = {case["id"] for case in data["math"]}
    for case in data["diagnosis"]:
        if case["math"] not in math_ids:
            raise ValueError("Unknown diagnosis math reference: " + case["math"])


def hint_constraint(value):
    if value in {"H0", "H1", "H2", "H3", "H4"}:
        return {"kind": "exact", "level": value}
    if value == "H3 أو أقل":
        return {"kind": "at_most", "level": "H3"}
    if value == "لا كشف":
        return {"kind": "no_reveal", "level": None}
    if value == "—":
        return {"kind": "unspecified", "level": None}
    raise ValueError("Unmapped hint expression: " + value)


def expected_projection(group, case):
    if group == "parse":
        return {"parseStatus": PARSE_STATUS[case["status"]],
                "reasonCode": None if case["reason"] == "—" else case["reason"]}
    if group == "math":
        return {"mathStatus": case["status"], "beforeSolutionSetText": case["before_set"],
                "afterSolutionSetText": case["after_set"], "witnessText": case["witness"],
                "misconceptionCandidate": case["misconception_candidate"], "kind": case["kind"]}
    if group == "diagnosis":
        return {"diagnosisPresent": case["state"] != "none",
                "diagnosisState": None if case["state"] == "none" else case["state"],
                "candidatePattern": None if case["pattern"] == "—" else case["pattern"],
                "probeText": case["probe"], "exclusionText": case["exclusion"]}
    if group == "tutoring":
        return {"mode": case["mode"], "hintConstraint": hint_constraint(case["hint_level"]),
                "expectedText": case["expected"], "forbiddenText": case["forbidden"]}
    if group == "state":
        return {"expectedText": case["expected"], "forbiddenText": case["forbidden"]}
    raise ValueError("Unknown fixture group: " + group)


def adapt(data):
    validate_fixtures(data)
    return {
        "schemaVersion": "golden-expectations-v1",
        "adapterVersion": "golden-adapter-v1",
        "sourceMetadata": {key: copy.deepcopy(data[key]) for key in
                           ("dataset_version", "generated_on", "review_status", "fixtures_schema")},
        "subjectReview": "unreviewed",
        "productExecution": "not_run",
        "cases": [{"id": case["id"], "group": group,
                   "sourceRecord": copy.deepcopy(case), "expected": expected_projection(group, case)}
                  for group in GROUPS for case in data[group]],
        "seedProblems": copy.deepcopy(data["seed_problems"]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deps", help="External directory containing jsonschema")
    parser.add_argument("--output", type=Path, default=ROOT / "qa-reports/golden-normalized.json")
    args = parser.parse_args()
    if args.deps:
        sys.path.insert(0, args.deps)
    path = ROOT / "docs/14-GOLDEN-DATASET.cases.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    result = adapt(data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"cases_adapted": len(result["cases"]), "seed_problems": len(result["seedProblems"]),
                      "product_tests_run": 0, "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
