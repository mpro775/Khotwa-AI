"""Synthetic requests for the existing internal contract."""

from khotwa_math import NOTATION_VERSION, WIRE_VERSION
from khotwa_math.model import Object

REQUEST_ID = "00000000-0000-4000-8000-000000000003"
STEP_ID = "00000000-0000-4000-8000-000000000004"


def payload(operation: str, old: str = "٢س=٤", new: str = "س=٢") -> Object:
    value: Object = {
        "schemaVersion": WIRE_VERSION,
        "requestId": REQUEST_ID,
        "context": {
            "attemptId": "00000000-0000-4000-8000-000000000001",
            "attemptRevision": 4,
            "problemRevisionId": "00000000-0000-4000-8000-000000000002",
            "notationProfile": NOTATION_VERSION,
            "domain": "reals",
        },
    }
    if operation == "parse":
        value.update(
            {
                "operation": "parse",
                "source": {"kind": "step", "stepVersionId": STEP_ID},
                "raw": old,
            }
        )
    elif operation == "verify-transition":
        value["transition"] = {
            "fromKind": "problem",
            "fromStepVersionId": None,
            "toStepVersionId": STEP_ID,
            "fromRaw": old,
            "toRaw": new,
        }
    else:
        value.update(
            {
                "operation": "check-final",
                "originalRaw": old,
                "finalStep": {"stepVersionId": STEP_ID, "raw": new},
            }
        )
    return value
