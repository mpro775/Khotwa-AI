"""Validate PH-00 contract proposals and fixture adaptation, never run product services."""
from pathlib import Path
import argparse
import copy
import difflib
import hashlib
import importlib.metadata
import json
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deps", required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.deps)
    import yaml
    from jsonschema import Draft202012Validator, FormatChecker
    from jsonschema.exceptions import ValidationError
    from openapi_spec_validator import OpenAPIV31SpecValidator
    from golden_adapter import adapt, validate_fixtures

    checks = []

    def check(name, action):
        try:
            detail = action()
            checks.append({"name": name, "passed": True, "detail": detail})
        except Exception as error:
            checks.append({"name": name, "passed": False, "error": str(error)})

    def require(condition, message):
        if not condition:
            raise ValueError(message)

    class UniqueLoader(yaml.SafeLoader):
        pass

    def mapping(loader, node, deep=False):
        result = {}
        for key, value in node.value:
            k = loader.construct_object(key, deep=deep)
            if k in result:
                raise ValueError("Duplicate YAML key: " + str(k))
            result[k] = loader.construct_object(value, deep=deep)
        return result

    UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
    api_path = ROOT / "docs/12-API-CONTRACT.yaml"
    api = yaml.load(api_path.read_text(encoding="utf-8"), Loader=UniqueLoader)
    internal = read("docs/contracts/math-internal-v1.schema.json")
    fixture_schema = read("docs/contracts/golden-fixtures-v1.schema.json")
    examples = read("docs/contracts/math-internal-v1.examples.json")["examples"]
    fixtures = read("docs/14-GOLDEN-DATASET.cases.json")
    before = read("qa-reports/ph00-correction-before.json")["files"]

    def openapi_check():
        errors = [str(e) for e in OpenAPIV31SpecValidator(api).iter_errors()]
        require(not errors, "\n".join(errors))
        require(hashlib.sha256(api_path.read_bytes()).hexdigest() == before["docs/12-API-CONTRACT.yaml"]["sha256"],
                "Public OpenAPI changed during PH-00 correction")
        return {"validator": "OpenAPIV31SpecValidator", "errors": 0, "public_file_byte_identical": True,
                "version": api["info"]["version"], "paths": len(api["paths"])}

    check("OpenAPI_3.1_standard_validation_and_public_contract_preservation", openapi_check)
    for name, schema in [("internal", internal), ("golden_fixtures", fixture_schema)]:
        check("Draft2020_12_metaschema_" + name, lambda s=schema: Draft202012Validator.check_schema(s))

    mirrored = [n for n in internal["$defs"] if n in api["components"]["schemas"]]

    def rewrite_refs(value):
        if isinstance(value, dict):
            return {k: (v.replace("#/components/schemas/", "#/$defs/") if k == "$ref" else rewrite_refs(v))
                    for k, v in value.items()}
        if isinstance(value, list):
            return [rewrite_refs(v) for v in value]
        return value

    def mirror_check():
        for name in mirrored:
            require(internal["$defs"][name] == rewrite_refs(api["components"]["schemas"][name]), "Schema drift: " + name)
        return {"schemas_compared": len(mirrored), "names": mirrored}

    check("Internal_shared_schemas_match_OpenAPI_exactly_except_local_refs", mirror_check)

    def validate_payload(name, payload):
        schema = {"$schema": internal["$schema"], "$defs": internal["$defs"], "$ref": "#/$defs/" + name}
        Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)
        if name == "InternalMathTransitionRequest":
            t = payload["transition"]
            require((t["fromKind"] == "problem") == (t["fromStepVersionId"] is None), "fromKind/version binding")
        ast = payload if name == "AstDocument" else payload.get("ast")
        if ast:
            raw = ast["sourceRaw"]
            count = 0

            def walk(node, depth, parent_span=None):
                nonlocal count
                count += 1
                require(count <= 128 and depth <= 16, "Proposed AST count/depth guard")
                span = node["sourceSpan"]
                require(0 <= span["start"] <= span["end"] <= len(raw), "Invalid code point span")
                if parent_span:
                    require(parent_span["start"] <= span["start"] <= span["end"] <= parent_span["end"], "Child span outside parent")
                for group in node.get("groupSpans", []):
                    require(0 <= group["start"] <= span["start"] <= span["end"] <= group["end"] <= len(raw), "Invalid grouping span")
                left = walk(node["left"], depth + 1, span) if "left" in node else False
                right = walk(node["right"], depth + 1, span) if "right" in node else False
                operand = walk(node["operand"], depth + 1, span) if "operand" in node else False
                require(node["type"] != "Multiply" or not (left and right), "Nonlinear variable product")
                require(node["type"] != "Divide" or not right, "Variable denominator")
                return node["type"] == "Variable" or left or right or operand

            walk(ast["root"], 1)
            if "context" in payload:
                require(ast["notationProfileVersion"] == payload["context"]["notationProfile"], "AST/profile mismatch")

    for i, example in enumerate(examples, 1):
        check(f"Illustrative_payload_{i}_{example['schema']}",
              lambda e=example: validate_payload(e["schema"], e["payload"]))

    def markdown_examples():
        text = (ROOT / "docs/10-MATH-ENGINE.md").read_text(encoding="utf-8")
        for heading, name in [("### 6.2", "AstDocument"), ("### 14.2", "InternalMathTransitionRequest"),
                              ("### 14.3", "InternalMathTransitionResult"), ("### 14.4", "InternalMathTransitionResult")]:
            start = text.index("```json\n", text.index(heading)) + len("```json\n")
            payload = json.loads(text[start:text.index("\n```", start)])
            validate_payload(name, payload)
            require(any(e["schema"] == name and e["payload"] == payload for e in examples), "MD/JSON example drift")
        return {"examples_checked": 4}

    check("Math_document_examples_schema_and_JSON_parity", markdown_examples)

    payloads = {e["schema"]: e["payload"] for e in examples[:4]}
    negative_count = 0

    def rejection(name, schema, payload):
        nonlocal negative_count
        negative_count += 1
        def test():
            try:
                validate_payload(schema, payload)
            except (ValueError, ValidationError) as error:
                return {"invalid_payload_rejected": True, "reason": str(error)[:220]}
            raise ValueError("Invalid payload unexpectedly accepted")
        check(name, test)

    def modified(name, change):
        value = copy.deepcopy(payloads[name])
        change(value)
        return value

    for field, value in [("schemaVersion", "math-internal-v99"), ("requestId", "not-a-uuid"), ("trustedAst", {})]:
        rejection("Reject_parse_" + field, "InternalMathParseRequest",
                  modified("InternalMathParseRequest", lambda p, f=field, v=value: p.update({f: v})))
    rejection("Reject_revision_over_Int32", "InternalMathParseRequest",
              modified("InternalMathParseRequest", lambda p: p["context"].update(attemptRevision=2147483648)))
    rejection("Reject_problem_source_with_step_version", "InternalMathParseRequest",
              modified("InternalMathParseRequest", lambda p: p["source"].update(kind="problem")))
    rejection("Reject_failed_parse_with_AST", "InternalMathParseResult",
              modified("InternalMathParseResult", lambda p: p.update(parseStatus="service_error", reasonCode="MATH_UNAVAILABLE")))
    rejection("Reject_unknown_AST_version", "InternalMathParseResult",
              modified("InternalMathParseResult", lambda p: p["ast"].update(schemaVersion="math-ast-v99")))
    rejection("Reject_AST_out_of_bounds_span", "InternalMathParseResult",
              modified("InternalMathParseResult", lambda p: p["ast"]["root"]["sourceSpan"].update(end=200)))
    rejection("Reject_completed_from_Python", "InternalMathCheckFinalResult",
              modified("InternalMathCheckFinalResult", lambda p: p.update(completed=True)))
    rejection("Reject_service_error_with_success_data", "InternalMathCheckFinalResult",
              modified("InternalMathCheckFinalResult", lambda p: p.update(status="service_error", reasonCode="TIMEOUT")))
    rejection("Reject_not_isolated_with_solution", "InternalMathCheckFinalResult",
              modified("InternalMathCheckFinalResult", lambda p: p.update(isIsolated=False)))

    for kind, raw in [("Multiply", "س*س = ٢"), ("Divide", "٢/س = ٢")]:
        invalid = copy.deepcopy(payloads["InternalMathParseResult"])
        sp = lambda a, b: {"start": a, "end": b, "unit": "unicode_codepoint"}
        variable = lambda a: {"type": "Variable", "name": "س", "sourceSpan": sp(a, a + 1)}
        integer = lambda a: {"type": "Integer", "value": "2", "sourceSpan": sp(a, a + 1)}
        left = {"type": kind, "sourceSpan": sp(0, 3),
                "left": variable(0) if kind == "Multiply" else integer(0), "right": variable(2)}
        if kind == "Multiply":
            left["implicit"] = False
        invalid["ast"]["sourceRaw"] = raw
        invalid["ast"]["root"] = {"type": "Equation", "sourceSpan": sp(0, 7), "left": left, "right": integer(6)}
        rejection("Reject_AST_" + kind + "_semantic_guard", "InternalMathParseResult", invalid)

    def not_isolated():
        p = copy.deepcopy(payloads["InternalMathCheckFinalResult"])
        p.update(isIsolated=False, solution=None, substitutionValid=None)
        validate_payload("InternalMathCheckFinalResult", p)
        return {"equivalent_does_not_mean_completed": True}

    check("Accept_equivalent_but_not_isolated_final_result", not_isolated)

    def current_binding():
        request = payloads["InternalMathCheckFinalRequest"]
        response = payloads["InternalMathCheckFinalResult"]
        def validate_exchange(req, res):
            require(req["context"] == res["context"] and req["requestId"] == res["requestId"], "Response/context does not match request snapshot")
            require(req["context"]["notationProfile"] == res["notationProfileVersion"], "Response notation profile changed")
            require(req["finalStep"]["stepVersionId"] == res["finalStepVersionId"], "Response final step version changed")
        validate_exchange(request, response)
        stale = copy.deepcopy(response)
        stale["context"]["attemptRevision"] -= 1
        try:
            validate_exchange(request, stale)
        except ValueError:
            return {"current_exchange_accepted_stale_exchange_rejected": True, "live_NestJS_guard_tested": False}
        raise ValueError("Stale response unexpectedly accepted by QA exchange check")

    check("Request_response_version_correlation_specification_check", current_binding)

    normalized = adapt(fixtures)

    def golden_check():
        require(normalized == read("qa-reports/golden-normalized.json"), "Adapter output is stale")
        require(fixtures == json.loads(before["docs/14-GOLDEN-DATASET.cases.json"]["text"]), "Source fixture changed")
        require(hashlib.sha256((ROOT / "docs/14-GOLDEN-DATASET.cases.json").read_bytes()).hexdigest() == before["docs/14-GOLDEN-DATASET.cases.json"]["sha256"], "Fixture bytes changed")
        require(len(normalized["cases"]) == 151 and len(normalized["seedProblems"]) == 18, "Wrong fixture count")
        require(fixtures["seed_problems"] == normalized["seedProblems"], "Seed loss")
        source = {case["id"]: case for group in ("parse", "math", "diagnosis", "tutoring", "state") for case in fixtures[group]}
        for case in normalized["cases"]:
            require(source[case["id"]] == case["sourceRecord"], "Source record mutated: " + case["id"])
            if case["group"] == "math":
                require(case["expected"]["mathStatus"] == case["sourceRecord"]["status"], "Math verdict altered")
            if case["group"] == "diagnosis" and case["sourceRecord"]["state"] == "none":
                require(case["expected"]["diagnosisState"] is None and not case["expected"]["diagnosisPresent"], "none projection")
        require(fixtures == json.loads(before["docs/14-GOLDEN-DATASET.cases.json"]["text"]), "Adapter mutated input")
        return {"records_schema_validated_and_adapted": 151, "seed_problems": 18, "expectations_preserved": True, "source_bytes_unchanged": True, "product_tests_run": 0}

    check("Golden_schema_mapping_and_lossless_source_preservation", golden_check)
    golden_mutations = [
        ("unknown_status", lambda x: x["parse"][0].update(status="verified_valid")),
        ("duplicate_id", lambda x: x["math"][1].update(id=x["math"][0]["id"])),
        ("dangling_diagnosis", lambda x: x["diagnosis"][0].update(math="GOLD-MATH-999")),
        ("missing_expected_status", lambda x: x["math"][0].pop("status")),
        ("extra_property", lambda x: x["parse"][0].update(actual_passed=True)),
        ("unknown_hint", lambda x: x["tutoring"][0].update(hint_level="H9")),
    ]
    for name, mutation in golden_mutations:
        def negative_golden(m=mutation):
            invalid = copy.deepcopy(fixtures)
            m(invalid)
            try:
                validate_fixtures(invalid)
            except (ValueError, ValidationError):
                return {"invalid_fixture_rejected": True}
            raise ValueError("Invalid fixture unexpectedly accepted")
        check("Reject_Golden_" + name, negative_golden)

    def node_json_roundtrip():
        probe = {"context": payloads["InternalMathParseRequest"]["context"], "raw": "س😀", "revisionMax": 2147483647}
        js = "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{let p=JSON.parse(s);process.stdout.write(JSON.stringify({payload:p,codePoints:Array.from(p.raw).length,utf16Units:p.raw.length,revisionSafe:Number.isSafeInteger(p.revisionMax)}))});"
        r = subprocess.run(["node", "-e", js], input=json.dumps(probe, ensure_ascii=False), text=True, encoding="utf-8", capture_output=True, check=True)
        actual = json.loads(r.stdout)
        require(actual["payload"] == probe and actual["codePoints"] == len(probe["raw"]) == 2 and actual["utf16Units"] == 3 and actual["revisionSafe"], "Python/Node JSON or span-unit mismatch")
        return {"node": subprocess.run(["node", "--version"], capture_output=True, text=True, check=True).stdout.strip(), "JSON_roundtrip": True, "unicode_codepoint_not_UTF16": True, "NestJS_runtime_test": False}

    check("Python_Node_JSON_Int32_Unicode_compatibility", node_json_roundtrip)

    def data_mapping():
        text = (ROOT / "docs/11-DATA-MODEL.md").read_text(encoding="utf-8")
        fields = ["attempt_revision_requested", "problem_revision_id", "from_kind", "from_step_version_id", "to_step_version_id", "engine_version", "notation_profile_version", "schema_version", "parse_status", "evidence_json"]
        require(all(field in text for field in fields), "Data-model mapping references an absent field")
        require("service_error" in text and "step_versions" in text, "Missing version/error representation")
        table_types = {"attempt_revision_requested": "bigint", "problem_revision_id": "uuid",
                       "from_step_version_id": "uuid", "to_step_version_id": "uuid",
                       "ast": "jsonb", "evidence_json": "jsonb", "schema_version": "varchar"}
        for field, expected in table_types.items():
            require(re.search(r"\| `" + field + r"` \| " + expected, text) is not None,
                    "Data-model type does not match mapping: " + field)
        context = internal["$defs"]["InternalMathContext"]["properties"]
        require(context["attemptRevision"]["maximum"] == 2147483647 and context["attemptRevision"]["minimum"] == 0,
                "Wire revision bound differs from safe Int32 mapping")
        require(all(context[name].get("format") == "uuid" for name in ["attemptId", "problemRevisionId"]),
                "Wire context ID is not UUID")
        return {"documented_fields_checked": fields, "table_types_compared": table_types,
                "Int32_wire_fits_bigint_storage": True, "database_or_migrations_run": False}

    check("Data_model_field_mapping_presence", data_mapping)

    def agents_preservation():
        original = before["docs/AGENTS.md"]["text"]
        current = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
        headings = re.findall(r"^## .+$", original, re.MULTILINE)
        require(all(heading in current for heading in headings), "Operational section lost in AGENTS relocation")
        original_body = original.rstrip().splitlines()
        relocated_body = current.split("\n\n## 21. تصحيح الموضع", 1)[0].rstrip().splitlines()
        allowed_prefixes = ("> **الإصدار:**", "> **ملاحظة:**", "| `17-IMPLEMENTATION-PLAN.md` |")
        editorial_changes = 0
        for tag, a, b, c, d in difflib.SequenceMatcher(a=original_body, b=relocated_body).get_opcodes():
            if tag == "equal":
                continue
            require(tag == "replace" and b - a == d - c and
                    all(line.startswith(allowed_prefixes) for line in original_body[a:b]),
                    "Operational AGENTS text was removed or changed outside authorized location/version metadata")
            editorial_changes += b - a
        pointer = (ROOT / "docs/AGENTS.md").read_text(encoding="utf-8")
        require("../AGENTS.md" in pointer and len(pointer) < 1000, "Nested instructions are not a forwarding pointer")
        return {"original_operational_sections_preserved": len(headings), "full_operational_body_preserved": True,
                "editorial_metadata_lines_changed": editorial_changes,
                "canonical": "AGENTS.md", "docs_copy": "forwarding_only"}

    check("Root_AGENTS_content_and_single_operational_authority", agents_preservation)

    def policy_alignment():
        forbidden = ["بيانات تركيبية موسومة أو جلسات مأذون", "بيانات مرخصة/تركيبية",
                     "بيانات اصطناعية موسومة بوضوح أو بيانات وافق صاحبها",
                     "بيانات اصطناعية أو مأذون بها فقط", "7 أيام من انتهاء الجلسة أو آخر نشاط"]
        found = []
        for path in (ROOT / "docs").glob("*.md"):
            text = path.read_text(encoding="utf-8")
            found.extend([{"file": path.name, "phrase": phrase} for phrase in forbidden if phrase in text])
        require(not found, "Obsolete contradictory policy clauses: " + str(found))
        privacy = (ROOT / "docs/16-SECURITY-PRIVACY.md").read_text(encoding="utf-8")
        require("7 أيام بعد انتهاء الجلسة" in privacy and "مراجعة الأمن" in privacy and "معلق" in privacy,
                "Retention baseline or pending-security qualification missing")
        return {"obsolete_policy_phrases_found": 0, "owner_policy_preserved_security_execution_pending": True}

    check("Teacher_demo_and_retention_policy_document_consistency", policy_alignment)
    report = {"date_riyadh": datetime.now(timezone(timedelta(hours=3))).isoformat(timespec="seconds"),
              "scope": "PH-00 static contracts, schema and QA adapter only; no application/service/DB execution",
              "command": 'python -X utf8 qa/validate_ph00_correction.py --deps "$env:TEMP\\khotwa-ph00-correction-deps"',
              "tools": {name: importlib.metadata.version(name) for name in ["PyYAML", "jsonschema", "openapi-spec-validator"]},
              "checks": checks, "passed": sum(c["passed"] for c in checks), "failed": sum(not c["passed"] for c in checks),
              "illustrative_payloads": len(examples), "negative_internal_payloads": negative_count,
              "negative_fixture_checks": len(golden_mutations), "product_golden_cases_run": 0,
              "live_component_integration_tested": False, "human_approval": "pending"}
    (ROOT / "qa-reports/ph00-correction-validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "checks"}, ensure_ascii=False, indent=2))
    for c in checks:
        if not c["passed"]:
            print(c["name"], c["error"][:800])
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
