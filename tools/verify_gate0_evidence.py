#!/usr/bin/env python3
"""Gate-0 evidence structural preflight; never authenticates human signatures or approves a gate.

Usage:
 python tools/verify_gate0_evidence.py --repo . \
   --manifest planning/gate0-freeze-manifest.json \
   --math-approval planning/approvals/actual-math-signoff.pdf \
   --engineering-approval planning/approvals/actual-eng-signoff.pdf

Output: qa-reports/gate0-evidence-preflight.json (contains no personal documents).
The owner/agent must still review signature authenticity and scope manually.
"""
from __future__ import annotations
import argparse, hashlib, json, re
from pathlib import Path

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def resolve_input(root: Path, path: str) -> Path:
    p = Path(path)
    return p.resolve() if p.is_absolute() else (root / p).resolve()

REQUIRED = (
    "AGENTS.md", "docs/PROJECT-DECISIONS.md", "docs/17-IMPLEMENTATION-PLAN.md",
    "docs/12-API-CONTRACT.yaml", "docs/contracts/math-internal-v1.schema.json",
    "docs/contracts/math-internal-v1.md", "docs/contracts/math-internal-v1.examples.json",
    "docs/contracts/golden-fixtures-v1.schema.json", "docs/contracts/golden-adapter-v1.md",
    "docs/14-GOLDEN-DATASET.cases.json", "planning/decisions.md",
    "planning/owners-and-gates.md", "qa-reports/gate-0.md")
FROZEN_REQUIRED = (
    "docs/12-API-CONTRACT.yaml", "docs/contracts/math-internal-v1.schema.json",
    "docs/contracts/math-internal-v1.md", "docs/contracts/math-internal-v1.examples.json",
    "docs/contracts/golden-fixtures-v1.schema.json", "docs/contracts/golden-adapter-v1.md",
    "docs/14-GOLDEN-DATASET.cases.json")

parser = argparse.ArgumentParser()
parser.add_argument("--repo", default=".")
parser.add_argument("--manifest", required=True)
parser.add_argument("--math-approval", required=True)
parser.add_argument("--engineering-approval", required=True)
parser.add_argument("--approval-basis", choices=("direct-reviewer", "owner-delegated"), default="direct-reviewer")
parser.add_argument("--owner-delegation")
parser.add_argument("--out", default="qa-reports/gate0-evidence-preflight.json")
args = parser.parse_args()
root = Path(args.repo).resolve()
errors = []
checks = []
delegation = {}
if args.approval_basis == "owner-delegated":
    if not args.owner_delegation:
        errors.append("owner-delegated mode requires the explicit owner-delegation record")
    else:
        try:
            delegation = json.loads(resolve_input(root, args.owner_delegation).read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as ex:
            errors.append("owner delegation unreadable: " + str(ex))
        if delegation:
            expected = {
                "schemaVersion": "gate0-owner-delegation-v1",
                "status": "APPROVED_BY_PROJECT_OWNER_VIA_AGENT_DELEGATION",
                "approvalModel": "OWNER_DELEGATED_AGENT_DESIGN_APPROVAL",
                "directReviewerSignaturesRequiredForGate0": False,
                "reviewerLinkedSignedFreezeRequiredForGate0": False,
                "humanReviewerSignaturesClaimed": False,
                "allowedNextPhase": "PH-01",
                "realLearnerDataAllowed": False,
                "runtimeTestsWaived": False,
                "publicDeploymentAllowed": False,
            }
            for key, value in expected.items():
                if type(delegation.get(key)) is not type(value) or delegation.get(key) != value:
                    errors.append("owner delegation has invalid or missing restriction: " + key)
            for key in ("ownerInstructionQuote", "ownerClarificationQuote", "recordedAt", "approvalAuthority"):
                if not isinstance(delegation.get(key), str) or not delegation[key].strip():
                    errors.append("owner delegation missing authority record: " + key)
for rel in REQUIRED:
    ok = (root / rel).is_file()
    checks.append({"check":"required_file", "file":rel,"passed":ok})
    if not ok: errors.append("missing: "+rel)
math = resolve_input(root,args.math_approval)
eng = resolve_input(root,args.engineering_approval)
if math == eng: errors.append("math and engineering approvals must be separate evidence")
for tag,path in (("math_approval",math),("engineering_approval",eng)):
    ok = path.is_file() and path.stat().st_size > 0
    checks.append({"check":tag,"passed":ok,"sha256":digest(path) if ok else None})
    if not ok: errors.append(tag+" missing or empty")
    if path.name.lower() in {"ph00-mohammad-murad-signoff-form.md","math-teacher-approval-gate0.md"}:
        errors.append(tag+" points to an unsigned template/owner attestation, not direct evidence")

manifestpath = resolve_input(root,args.manifest)
if not manifestpath.is_file():
    errors.append("freeze manifest absent")
    manifest = {}
else:
    try: manifest = json.loads(manifestpath.read_text(encoding="utf-8-sig"))
    except (ValueError,UnicodeError) as ex:
        errors.append("freeze manifest JSON invalid: "+str(ex)); manifest = {}
if manifest:
    required_metadata = ("freezeId","sourceCommit","frozenAt","engineeringApprovalEvidence","mathApprovalEvidence") if args.approval_basis == "direct-reviewer" else ("sourceCommit",)
    for k in required_metadata:
        val=manifest.get(k)
        if not isinstance(val,str) or not val.strip() or "REPLACE" in val:
            errors.append("freeze manifest missing genuine value: "+k)
    allfiles=manifest.get("files",[])
    if not isinstance(allfiles,list):
        errors.append("manifest.files must be a list");allfiles=[]
    bypath={v.get("path"):v for v in allfiles if isinstance(v,dict)}
    for rel in FROZEN_REQUIRED:
        item=bypath.get(rel)
        if not item:
            errors.append("freeze manifest missing path: "+rel);continue
        s=item.get("sha256")
        p=root/rel
        valid=isinstance(s,str) and bool(re.fullmatch(r"[0-9a-f]{64}",s))
        equal=valid and p.is_file() and digest(p)==s
        checks.append({"check":"contract_hash","file":rel,"passed":equal})
        if not equal: errors.append("contract hash missing or mismatch: "+rel)
    authority = manifest if args.approval_basis == "direct-reviewer" else delegation
    for k,real in (("mathApprovalEvidence",math),("engineeringApprovalEvidence",eng)):
        v=authority.get(k)
        if isinstance(v,str) and "REPLACE" not in v:
            if resolve_input(root,v) != real: errors.append("signoff mismatch: manifest."+k)
    if args.approval_basis == "owner-delegated":
        if not delegation:
            errors.append("explicit owner delegation absent")
        else:
            for key in ("mathApprovalEvidence", "engineeringApprovalEvidence", "contractInventory"):
                value = delegation.get(key)
                p = resolve_input(root, value) if isinstance(value, str) else None
                if p is None or not p.is_file() or digest(p) != delegation.get(key + "Sha256"):
                    errors.append("delegated approval evidence hash mismatch: " + key)
            if resolve_input(root, delegation.get("contractInventory", "")) != manifestpath:
                errors.append("owner delegation points to a different contract inventory")
            for p in (math, eng):
                if p.is_file() and "OWNER_DELEGATED_AGENT_DESIGN_APPROVAL" not in p.read_text(encoding="utf-8-sig"):
                    errors.append("delegated record does not disclose its true approval basis")

output={"gate":"GATE-0","scope":"structural-only; manual review of identity/scope still required",
        "approval_basis":args.approval_basis,"reviewer_signatures_authenticated":False,
        "structural_pass":not errors,"errors":errors,"checks":checks,
        "gate_approved_by_this_script":False,"ph01_authorized_by_this_script":False}
out = resolve_input(root,args.out)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"structural_pass":not errors,"errors":errors,"report":str(out)},ensure_ascii=False,indent=2))
raise SystemExit(0 if not errors else 2)
