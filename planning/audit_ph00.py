"""Read-only PH-00 source audit. Writes review evidence, never changes specifications.

Run from any directory: python -X utf8 planning/audit_ph00.py
Optional YAML checks: install PyYAML 6.0.3 outside the project and pass --yaml-path.
This is a document audit, not execution of the Khotwa product or its Golden cases.
"""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parents[1]
GROUPS = {"parse": 40, "math": 57, "diagnosis": 18, "tutoring": 18, "state": 18}
DEC_ID = r"(?:[A-Z]+-)?DEC-\d{2}"


def dump(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def git(*args):
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    return result.stdout.strip() if result.returncode == 0 else None


def verify_delivery():
    baseline = json.loads((ROOT / "planning/source-baseline.json").read_text(encoding="utf-8"))
    changed = []
    for name, record in baseline["sources"].items():
        path = ROOT / name
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != record["sha256"]:
            changed.append(name)
    required = ["planning/decisions.md", "planning/spec-conflicts.md", "planning/document-review.md",
                "planning/input-and-content-baseline.md", "planning/contract-baseline.md",
                "planning/technical-decisions.md", "planning/owners-and-gates.md",
                "planning/decision-inventory.json", "qa/golden-review-register.md",
                "qa-reports/gate-0.md", "qa-reports/README.md", "qa-reports/ph00-document-audit.json",
                "AGENTS.md", "docs/AGENTS.md", "planning/approval-evidence.md", "planning/review-pack.md",
                "docs/contracts/math-internal-v1.schema.json", "docs/contracts/golden-fixtures-v1.schema.json",
                "docs/contracts/math-internal-v1.examples.json", "docs/contracts/math-internal-v1.md",
                "docs/contracts/golden-adapter-v1.md", "qa/golden_adapter.py", "qa/validate_ph00_correction.py",
                "qa-reports/ph00-correction-validation.json", "qa-reports/ph00-correction-report.md",
                *[f"agent-reports/TASK-{n:03}.md" for n in range(1, 9)]]
    missing = [name for name in required if not (ROOT / name).is_file()]
    broken = []
    whitespace = []
    link_count = 0
    for folder in ["planning", "qa", "qa-reports", "agent-reports", "docs"]:
        for path in (ROOT / folder).rglob("*"):
            if not path.is_file():
                continue
            if path.suffix not in {".md", ".json", ".py"}:
                continue
            content = path.read_text(encoding="utf-8")
            if path.suffix == ".json":
                json.loads(content)
            for number, line in enumerate(content.splitlines(), 1):
                if line.rstrip() != line and not (folder == "docs" and line.endswith("  ")):
                    whitespace.append(f"{path.relative_to(ROOT).as_posix()}:{number}")
            if path.suffix != ".md":
                continue
            for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", content):
                if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                    continue
                link_count += 1
                if not (path.parent / target.split("#", 1)[0]).is_file():
                    broken.append({"file": path.relative_to(ROOT).as_posix(), "target": target})
    audit = json.loads((ROOT / "qa-reports/ph00-document-audit.json").read_text(encoding="utf-8"))
    root_agents = ROOT / "AGENTS.md"
    if root_agents.exists():
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", root_agents.read_text(encoding="utf-8")):
            if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) and not target.startswith("#"):
                link_count += 1
                if not (ROOT / target.split("#", 1)[0]).is_file():
                    broken.append({"file": "AGENTS.md", "target": target})
    report = {"scope": "PH-00 documentation delivery integrity, not product acceptance",
              "source_files_checked": len(baseline["sources"]), "changed_source_files": changed,
              "missing_deliverables": missing, "local_markdown_links_checked": link_count,
              "broken_local_links": broken, "trailing_whitespace": whitespace,
              "all_generated_json_decoded": True, "individual_task_reports": 8,
              "task_ids": [f"TASK-{n:03}" for n in range(1, 9)],
              "application_directories_created": [n for n in ["apps", "services", "packages"] if (ROOT / n).exists()],
              "yaml_audit_executed": audit["yaml"]["executed"], "product_tests_run": 0}
    report["integrity_passed"] = not any([changed, missing, broken, whitespace, report["application_directories_created"]])
    dump("qa-reports/ph00-delivery-verification.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if (ROOT / "qa-reports/ph00-correction-before.json").exists():
        before = json.loads((ROOT / "qa-reports/ph00-correction-before.json").read_text(encoding="utf-8"))["files"]
        current_paths = [ROOT / "AGENTS.md", ROOT / "README.md"] + [p for folder in ["docs", "planning", "qa", "qa-reports", "agent-reports"] for p in (ROOT / folder).rglob("*") if p.is_file()]
        changes = []
        index_name = "qa-reports/ph00-correction-files.json"
        for path in sorted(current_paths):
            name = path.relative_to(ROOT).as_posix()
            if name == index_name:
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if name not in before or digest != before[name]["sha256"]:
                changes.append({"path": name, "change": "modified" if name in before else "added", "sha256": digest})
        changes.append({"path": index_name, "change": "added", "sha256": None, "note": "Self-index; no recursive self-hash"})
        deleted = [name for name in before if not (ROOT / name).exists()]
        dump(index_name, {"scope": "Changes in user-authorized PH-00 correction only", "files": changes, "deleted": deleted,
                          "preexisting_git_deletions_untouched": ["00-PROJECT-VISION.md", "01_KHOTWA_PRODUCT_VISION_AR.md", "02_KHOTWA_PRODUCT_REQUIREMENTS_AR.md"]})
    return 0 if report["integrity_passed"] else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--yaml-path")
    parser.add_argument("--verify-delivery", action="store_true")
    args = parser.parse_args()
    if args.verify_delivery:
        return verify_delivery()
    sources = {}
    for path in sorted([ROOT / "README.md", ROOT / "AGENTS.md", *(ROOT / "docs").rglob("*")]):
        if not path.is_file():
            continue
        raw = path.read_bytes()
        encoding = "utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
        content = raw.decode(encoding)
        sources[path.relative_to(ROOT).as_posix()] = {
            "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "encoding": encoding,
            "lines": len(content.splitlines()), "text": content,
            "headings": [{"line": i, "text": line} for i, line in enumerate(content.splitlines(), 1)
                         if re.match(r"^#{1,4} ", line)],
        }

    decision_text = sources["docs/PROJECT-DECISIONS.md"]["text"]
    document = None
    decisions = []
    for number, line in enumerate(decision_text.splitlines(), 1):
        heading = re.match(r"### 6\.\d+ (\S+\.(?:md|yaml))", line)
        if heading:
            document = heading[1]
        match = re.match(r"\| `(" + DEC_ID + r")` \|", line)
        if not match:
            continue
        cells = [part.strip() for part in line.strip().strip("|").split("|")]
        original = sources.get("docs/" + document, {}).get("text", "")
        owner_lines = [{"line": i, "text": value} for i, value in enumerate(original.splitlines(), 1)
                       if re.match(r"\| `?" + re.escape(match[1]) + r"`? \|", value)]
        if document.endswith("yaml"):
            owner_lines = [{"line": i, "text": "\n".join(original.splitlines()[i-1:i+5])}
                           for i, value in enumerate(original.splitlines(), 1)
                           if value.strip() == "- id: " + match[1]]
        decisions.append({"id": match[1], "document": document, "topic": cells[1],
                          "choice": cells[2], "source_status": cells[3],
                          "register_line": number, "owner_source_rows": owner_lines})

    data = json.loads(sources["docs/14-GOLDEN-DATASET.cases.json"]["text"])
    golden_md = sources["docs/14-GOLDEN-DATASET.md"]["text"]
    md_rows = {}
    for number, line in enumerate(golden_md.splitlines(), 1):
        if re.match(r"\| (?:GOLD-|KH-ALG-)", line):
            cells = [x.strip().replace("`", "") for x in line.strip().strip("|").split("|")]
            md_rows[cells[0]] = (number, cells)
    all_cases = [case for group in GROUPS for case in data[group]]
    ids = [case["id"] for case in all_cases]
    id_set = set(ids)
    content_mismatches = []
    comparisons = 0
    for group in [*GROUPS, "seed_problems"]:
        for case in data[group]:
            row = md_rows.get(case["id"])
            if row is None:
                content_mismatches.append({"id": case["id"], "error": "missing_markdown_row"})
                continue
            cells = row[1]
            values = {
                "parse": lambda c: [c["id"], c["raw"], c["status"], c["reason"] + " — " + c["note"]],
                "math": lambda c: [c["id"], c["before"] + " ← " + c["after"], c["status"],
                                   c["before_set"] + " ← " + c["after_set"], c["witness"],
                                   c["skill"] + " / " + (c["misconception_candidate"] or "—")],
                "diagnosis": lambda c: [c["id"], c["math"], c["state"], c["pattern"], c["probe"] + " — " + c["why"]],
                "tutoring": lambda c: [c["id"], c["trigger"], c["mode"], c["hint_level"], c["expected"], c["forbidden"]],
                "state": lambda c: [c["id"], c["event"], c["expected"], c["forbidden"]],
                "seed_problems": lambda c: [c["id"], c["kind"], c["skill"], c["equation"], c["answer"]],
            }[group](case)
            normalized = [str(v).replace("`", "") for v in values]
            comparisons += 1
            if normalized != cells:
                content_mismatches.append({"id": case["id"], "line": row[0], "json_projection": normalized, "markdown": cells})
    dangling_diag = [{"id": c["id"], "reference": c["math"]} for c in data["diagnosis"]
                     if c["math"].startswith("GOLD-") and c["math"] not in id_set]

    checks = {
        "golden_group_counts": {g: len(data[g]) for g in GROUPS},
        "golden_expected_counts_match": all(len(data[g]) == count for g, count in GROUPS.items()),
        "golden_total": len(ids), "duplicate_golden_ids": [v for v, n in collections.Counter(ids).items() if n > 1],
        "math_status_counts": dict(collections.Counter(c["status"] for c in data["math"])),
        "parse_status_counts": dict(collections.Counter(c["status"] for c in data["parse"])),
        "math_kind_counts": dict(collections.Counter(c["kind"] for c in data["math"])),
        "golden_markdown_rows_compared": comparisons, "golden_content_mismatches": content_mismatches,
        "dangling_diagnosis_references": dangling_diag,
        "decision_count": len(decisions),
        "decision_status_counts": dict(collections.Counter(c["source_status"] for c in decisions)),
        "decisions_without_owner_source_row": [c["id"] for c in decisions if not c["owner_source_rows"]],
        "duplicate_decision_ids": [v for v, n in collections.Counter(c["id"] for c in decisions).items() if n > 1],
    }
    yaml_audit = {"executed": False, "reason": "PyYAML unavailable; no YAML validity claim"}
    if args.yaml_path:
        sys.path.insert(0, args.yaml_path)
    try:
        import yaml
    except ImportError:
        pass
    else:
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
        contract = yaml.load(sources["docs/12-API-CONTRACT.yaml"]["text"], Loader=UniqueLoader)
        refs = []
        def walk(node):
            if isinstance(node, dict):
                if "$ref" in node:
                    refs.append(node["$ref"])
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)
        walk(contract)
        unresolved = []
        external = []
        for ref in refs:
            if not ref.startswith("#/"):
                external.append(ref)
                continue
            node = contract
            try:
                for part in ref[2:].split("/"):
                    node = node[part.replace("~1", "/").replace("~0", "~")]
            except (KeyError, TypeError):
                unresolved.append(ref)
        operations = [{"path": path, "method": method, "operationId": operation.get("operationId")}
                      for path, item in contract["paths"].items() for method, operation in item.items()
                      if method in {"get", "post", "patch", "put", "delete", "head", "options", "trace"}]
        operation_ids = [o["operationId"] for o in operations]
        yaml_audit = {"executed": True, "parser": "PyYAML " + yaml.__version__,
                      "openapi": contract["openapi"], "info_version": contract["info"]["version"],
                      "paths": len(contract["paths"]), "operations": operations,
                      "schemas": len(contract["components"]["schemas"]), "ref_occurrences": len(refs),
                      "unresolved_local_refs": sorted(set(unresolved)), "external_refs": sorted(set(external)),
                      "duplicate_operation_ids": [k for k, n in collections.Counter(operation_ids).items() if n > 1],
                      "schemas_summary": {key: {k: value[k] for k in ["type", "required", "properties", "enum"] if k in value}
                                          for key, value in contract["components"]["schemas"].items()
                                          if key.startswith("InternalMath") or key in {"MathStatus", "MathIssue", "Step", "ParseResult"}}}

    stamp = datetime.now(timezone(timedelta(hours=3))).isoformat(timespec="seconds")
    manifest = {"phase": "PH-00", "captured_at_riyadh": stamp, "branch": git("branch", "--show-current"),
                "head": git("rev-parse", "HEAD"),
                "scope": "Document baseline only; not an approved freeze or product test run",
                "missing_planned_documents": [p for p in ["03-RESEARCH.md", "18-DEMO-AND-DELIVERY.md"] if not (ROOT / "docs" / p).exists()],
                "sources": {k: {x: y for x, y in v.items() if x != "text"} for k, v in sources.items()}}
    dump("planning/source-baseline.json", manifest)
    dump("planning/decision-inventory.json", decisions)
    dump("qa-reports/ph00-document-audit.json", {"captured_at_riyadh": stamp, "product_tests_run": 0,
          "scientific_review": "not_performed", "checks": checks, "yaml": yaml_audit})

    register = ["# سجل مراجعة Golden — TASK-005", "", "> PH-00 • 2026-11-04 • الحالة: جاهز للمراجعة البنيوية؛ الاعتماد العلمي محجوب.", "",
                "المصدر: `../docs/14-GOLDEN-DATASET.cases.json` إصدار `" + data["dataset_version"] + "`، ومقابله ملف Markdown.", "",
                "`status` و`accepted` داخل fixture هما **توقع تشغيل**، وليسا اعتمادًا بشريًا أو نتيجة اجتياز. جميع الحالات أدناه `unreviewed` علميًا و`not_run` على المنتج، دون تجميد معتمد.", "",
                "المراجعة البنيوية تشمل قراءة كل سجل، العدد، تفرّد المعرف، مطابقة الحقول المنشورة في Markdown، ومراجع التشخيص. لا تشمل صحة الرياضيات أو ملاءمة التلميح تربويًا.", "",
                "الدليل التفصيلي: [تدقيق الوثائق](../qa-reports/ph00-document-audit.json). البصمات: [baseline](../planning/source-baseline.json).", "",
                "| المجموعة | معدة | reviewed علميًا | مجمدة باعتماد | تشغيل المنتج |", "|---|---:|---:|---:|---:|"]
    for group in GROUPS:
        register.append(f"| {group} | {len(data[group])} | 0 | 0 | 0 |")
    register += ["", "## السجل الفردي", "", "| المعرف | المجموعة | التوقع المسجل | فحص بنيوي | مراجعة المختص | التجميد | التشغيل | المراجع/التاريخ |", "|---|---|---|---|---|---|---|---|"]
    mismatched_ids = {c["id"] for c in content_mismatches}
    for group in GROUPS:
        for case in data[group]:
            expected = case.get("status", case.get("state", case.get("hint_level", "سلوك موصوف في المصدر")))
            structural = "needs_changes" if case["id"] in mismatched_ids else "مطابق للجدول"
            register.append(f"| {case['id']} | {group} | {expected} | {structural} | unreviewed | غير مجمد | not_run | بانتظار التعيين/المراجعة |")
    register += ["", "## بنك المسائل", "", "هذه 18 بذرة محتوى منفصلة عن مجموع 151؛ لا تُعد حالات Golden إضافية ولا مسائل منشورة معتمدة.", "",
                 "| المعرف | النوع | المهارة | المراجعة العلمية | النشر |", "|---|---|---|---|---|"]
    for case in data["seed_problems"]:
        register.append(f"| {case['id']} | {case['kind']} | {case['skill']} | unreviewed | غير منشور |")
    register += ["", "## اعتماد القسم والتقييم المحجوب", "", "| القسم | الحالة | المطلوب |", "|---|---|---|"]
    for group in GROUPS:
        register.append(f"| {group} | unreviewed | مختص المجال + QA، أسماء وتواريخ وقرار فردي لكل حالة |")
    register += ["| عينة التقييم المحجوبة | غير متاحة بدليل مستقل | QA يحدد العائلات والحفظ والفصل؛ لا تعد الحالات المرئية عينة محجوبة |", "",
                 "بعد تصحيح PH-00: [Schema وadapter](../docs/contracts/golden-adapter-v1.md) جاهزان و[الفحوص الفعلية](../qa-reports/ph00-correction-validation.json) تخص البنية والتحويل فقط؛ جميع التوقعات الأصلية محفوظة وصفر تشغيل منتج.", "",
                 "الخطوة التالية: تعيين المراجعين عبر `planning/owners-and-gates.md`، ثم توثيق reviewed/needs_changes ودليل المراجع؛ لا تُغيّر النتائج المتوقعة ولا تُجمّد الحزمة قبل ذلك.", ""]
    (ROOT / "qa").mkdir(exist_ok=True)
    (ROOT / "qa/golden-review-register.md").write_text("\n".join(register), encoding="utf-8")
    print(json.dumps({"sources": len(sources), "checks": checks,
                      "yaml": {k: v for k, v in yaml_audit.items() if k not in {"operations", "schemas_summary"}}}, ensure_ascii=False, indent=2))
    failures = [not checks["golden_expected_counts_match"], checks["duplicate_golden_ids"],
                checks["golden_content_mismatches"], checks["dangling_diagnosis_references"],
                checks["decisions_without_owner_source_row"], checks["duplicate_decision_ids"]]
    if yaml_audit["executed"]:
        failures.extend([yaml_audit["unresolved_local_refs"], yaml_audit["duplicate_operation_ids"]])
    return 1 if any(failures) else 0


if __name__ == "__main__":
    sys.exit(main())
