"""Existing math-internal-v1 wire contract; validation has no math imports."""

from dataclasses import dataclass
from uuid import UUID

from . import AST_VERSION, ENGINE_VERSION, NOTATION_VERSION, WIRE_VERSION
from .model import Budget, Json, MathFailure, Object

ROUTES = {
    "/internal/v1/math/parse": "parse",
    "/internal/v1/math/verify-transition": "verify-transition",
    "/internal/v1/math/check-final": "check-final",
}


class ContractError(ValueError):
    pass


def obj(value: Json, keys: set[str]) -> Object:
    if not isinstance(value, dict) or set(value) != keys:
        raise ContractError("invalid_request")
    return value


def uuid(value: Json) -> None:
    if not isinstance(value, str):
        raise ContractError("invalid_request")
    try:
        if str(UUID(value)).lower() != value.lower():
            raise ValueError
    except ValueError as exc:
        raise ContractError("invalid_request") from exc


def source(value: Json, minimum: int = 1) -> str:
    if not isinstance(value, str) or not minimum <= len(value) <= 256:
        raise ContractError("invalid_request")
    return value


@dataclass(frozen=True)
class Request:
    operation: str
    value: Object
    context: Object
    old_raw: str
    new_raw: str = ""


def validate_request(operation: str, value: Json) -> Request:
    shared = {"schemaVersion", "requestId", "context"}
    extra = {
        "parse": {"operation", "source", "raw"},
        "verify-transition": {"transition"},
        "check-final": {"operation", "originalRaw", "finalStep"},
    }
    if operation not in extra:
        raise ContractError("invalid_request")
    data = obj(value, shared | extra[operation])
    if data["schemaVersion"] != WIRE_VERSION:
        raise ContractError("schema_version_mismatch")
    uuid(data["requestId"])
    context = obj(
        data["context"],
        {
            "attemptId",
            "attemptRevision",
            "problemRevisionId",
            "notationProfile",
            "domain",
        },
    )
    uuid(context["attemptId"])
    uuid(context["problemRevisionId"])
    revision = context["attemptRevision"]
    if (
        type(revision) is not int
        or not 0 <= revision <= 2147483647
        or context["domain"] != "reals"
        or not isinstance(context["notationProfile"], str)
    ):
        raise ContractError("invalid_request")
    if operation == "verify-transition":
        transition = obj(
            data["transition"],
            {"fromKind", "fromStepVersionId", "toStepVersionId", "fromRaw", "toRaw"},
        )
        if transition["fromKind"] == "problem":
            if transition["fromStepVersionId"] is not None:
                raise ContractError("invalid_request")
        elif transition["fromKind"] == "step":
            uuid(transition["fromStepVersionId"])
        else:
            raise ContractError("invalid_request")
        uuid(transition["toStepVersionId"])
        return Request(
            operation,
            data,
            context,
            source(transition["fromRaw"], 0),
            source(transition["toRaw"], 0),
        )
    if data["operation"] != operation:
        raise ContractError("invalid_request")
    if operation == "parse":
        ref = obj(data["source"], {"kind", "stepVersionId"})
        if ref["kind"] == "problem":
            if ref["stepVersionId"] is not None:
                raise ContractError("invalid_request")
        elif ref["kind"] == "step":
            uuid(ref["stepVersionId"])
        else:
            raise ContractError("invalid_request")
        return Request(operation, data, context, source(data["raw"]))
    final = obj(data["finalStep"], {"stepVersionId", "raw"})
    uuid(final["stepVersionId"])
    return Request(
        operation, data, context, source(data["originalRaw"]), source(final["raw"])
    )


def base(request: Request) -> Object:
    result: Object = {
        "schemaVersion": WIRE_VERSION,
        "requestId": request.value["requestId"],
        "engineVersion": ENGINE_VERSION,
        "notationProfileVersion": NOTATION_VERSION,
    }
    if request.operation == "verify-transition":
        result.update(
            {
                "attemptRevision": request.context["attemptRevision"],
                "status": "service_error",
                "reasonCode": None,
                "evidence": None,
                "issue": None,
            }
        )
    else:
        result.update(
            {
                "context": request.context,
                "operation": request.operation,
                "reasonCode": None,
                "issue": None,
            }
        )
        if request.operation == "parse":
            result.update(
                {
                    "source": request.value["source"],
                    "astSchemaVersion": AST_VERSION,
                    "parseStatus": "service_error",
                    "normalizedText": None,
                    "displayAr": None,
                    "ast": None,
                }
            )
        else:
            final = request.value["finalStep"]
            assert isinstance(final, dict)
            result.update(
                {
                    "finalStepVersionId": final["stepVersionId"],
                    "status": "service_error",
                    "isIsolated": None,
                    "substitutionValid": None,
                    "solution": None,
                    "originalSolution": None,
                    "finalSolution": None,
                    "evidence": None,
                }
            )
    return result


def failure_response(request: Request, failure: MathFailure) -> Object:
    result = base(request)
    result["parseStatus" if request.operation == "parse" else "status"] = failure.status
    result["reasonCode"], result["issue"] = failure.code, failure.issue()
    return result


def execute(request: Request, budget: Budget | None = None) -> Object:
    # Only the isolated, prepared worker imports SymPy/the engine.
    from .engine import analyze, compare, isolated, satisfied
    from .linear import rational

    budget = budget or Budget()
    try:
        if request.context["notationProfile"] != NOTATION_VERSION:
            raise MathFailure(
                "service_error",
                "NOTATION_PROFILE_MISMATCH",
                "نسخة الاصطلاح المطلوبة غير متاحة في هذا المحرك.",
            )
        result = base(request)
        if request.operation == "parse":
            parsed = analyze(request.old_raw, budget)
            result.update(
                {
                    "parseStatus": "parsed",
                    "normalizedText": parsed.normalized,
                    "displayAr": parsed.display,
                    "ast": {
                        "schemaVersion": AST_VERSION,
                        "notationProfileVersion": NOTATION_VERSION,
                        "sourceRaw": parsed.raw,
                        "root": parsed.root.wire(),
                    },
                }
            )
        else:
            compared = compare(request.old_raw, request.new_raw, budget)
            result["status"] = compared.status
            result["evidence"] = compared.evidence
            if compared.status == "verified_invalid":
                result["reasonCode"] = "SOLUTION_SET_MISMATCH"
            if request.operation == "check-final":
                is_isolated, value = isolated(compared.after, budget)
                result.update(
                    {
                        "isIsolated": is_isolated,
                        "originalSolution": compared.before.solution.wire(),
                        "finalSolution": compared.after.solution.wire(),
                    }
                )
                if value is not None:
                    result["solution"] = rational(value)
                    result["substitutionValid"] = satisfied(
                        compared.before, value, budget
                    )
        budget.tick()
        return result
    except MathFailure as exc:
        return failure_response(request, exc)
    except Exception:
        return failure_response(
            request,
            MathFailure(
                "service_error", "INTERNAL_FAILURE", "تعذر التحقق بسبب عطل داخلي."
            ),
        )
