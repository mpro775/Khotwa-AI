"""Bounded 1D kinematics verifier, separate from the algebra language/AST.

All quantities are exact rationals. The unit registry is deliberately an
allowlist of five school units, with exact SI scale factors; it is not a unit
expression parser. Neither SymPy parsing nor learner code is evaluated.
"""

import re
from typing import Any

from sympy import Rational

VERSION = "physics-internal-v1"
ENGINE = "physics-1.0.0"
UNITS = {
    "m": ("length", Rational(1)),
    "s": ("time", Rational(1)),
    "m/s": ("speed", Rational(1)),
    "m/s²": ("acceleration", Rational(1)),
    "km/h": ("speed", Rational(5, 18)),
}
ALIASES = {"m/s^2": "m/s²", "m/s2": "m/s²"}
DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩−٫", "0123456789-.")
NUMBER = re.compile(r"^-?(?:[0-9]{1,12}(?:\.[0-9]{1,6})?|[0-9]{1,12}/[0-9]{1,12})$")
FORMULAS = {
    "constant_speed_distance": ("distance", "length", ("v", "t")),
    "constant_velocity_displacement": ("displacement", "length", ("v", "t")),
    "average_speed": ("speed", "speed", ("d", "t")),
    "average_velocity": ("velocity", "speed", ("dx", "t")),
    "final_velocity": ("velocity", "speed", ("v0", "a", "t")),
    "displacement": ("displacement", "length", ("v0", "a", "t")),
    "acceleration": ("acceleration", "acceleration", ("v", "v0", "t")),
    "elapsed_time": ("time", "time", ("dx", "v")),
}


def number(value: object) -> Rational:
    if not isinstance(value, str) or len(value) > 28:
        raise ValueError("INVALID_NUMBER")
    raw = value.translate(DIGITS)
    if not NUMBER.fullmatch(raw):
        raise ValueError("INVALID_NUMBER")
    if "/" in raw:
        numerator, denominator = raw.split("/")
        if int(denominator) == 0:
            raise ValueError("ZERO_DENOMINATOR")
        result = Rational(int(numerator), int(denominator))
    elif "." in raw:
        sign = -1 if raw.startswith("-") else 1
        whole, fraction = raw.lstrip("-").split(".")
        result = Rational(sign * int(whole + fraction), 10 ** len(fraction))
    else:
        result = Rational(int(raw))
    if not isinstance(result, Rational):
        raise ValueError("INVALID_NUMBER")
    if abs(result) > 10**12:
        raise ValueError("NUMBER_OUT_OF_RANGE")
    return result


def exact_keys(
    value: object, required: set[str], optional: set[str] | None = None
) -> dict[str, Any]:
    if not isinstance(value, dict) or not required <= value.keys():
        raise ValueError("INVALID_INPUT")
    if not value.keys() <= required | (optional or set()):
        raise ValueError("INVALID_INPUT")
    return value


def reference(value: object) -> tuple[dict[str, Any], Rational]:
    spec = exact_keys(
        value,
        {
            "topic",
            "formula",
            "quantity",
            "expectedDimension",
            "expectedValueSI",
            "expectedUnit",
            "tolerance",
            "givens",
        },
        {"constraints"},
    )
    if spec["topic"] != "kinematics_1d" or spec["formula"] not in FORMULAS:
        raise ValueError("UNSUPPORTED_TOPIC")
    quantity, dimension, fields = FORMULAS[spec["formula"]]
    if spec["quantity"] != quantity or spec["expectedDimension"] != dimension:
        raise ValueError("INVALID_REFERENCE_DIMENSION")
    unit = (
        UNITS.get(spec["expectedUnit"])
        if isinstance(spec["expectedUnit"], str)
        else None
    )
    if unit is None or unit[0] != dimension:
        raise ValueError("INVALID_REFERENCE_UNIT")
    givens = exact_keys(spec["givens"], set(fields))
    values = {key: number(item) for key, item in givens.items()}
    if "t" in values and values["t"] < 0:
        raise ValueError("NEGATIVE_TIME")
    if quantity == "speed" and values.get("d", Rational(0)) < 0:
        raise ValueError("NEGATIVE_DISTANCE")
    formula = spec["formula"]
    if formula == "constant_speed_distance":
        calculated = abs(values["v"]) * values["t"]
    elif formula == "constant_velocity_displacement":
        calculated = values["v"] * values["t"]
    elif formula in {"average_speed", "average_velocity"}:
        if values["t"] <= 0:
            raise ValueError("NONPOSITIVE_TIME")
        calculated = values["d" if formula == "average_speed" else "dx"] / values["t"]
    elif formula == "final_velocity":
        calculated = values["v0"] + values["a"] * values["t"]
    elif formula == "displacement":
        calculated = values["v0"] * values["t"] + values["a"] * values["t"] ** 2 / 2
    elif formula == "acceleration":
        if values["t"] <= 0:
            raise ValueError("NONPOSITIVE_TIME")
        calculated = (values["v"] - values["v0"]) / values["t"]
    else:
        if values["v"] == 0:
            raise ValueError("ZERO_SPEED")
        calculated = values["dx"] / values["v"]
        if calculated < 0:
            raise ValueError("NEGATIVE_TIME")
    expected = number(spec["expectedValueSI"])
    tolerance = number(spec["tolerance"])
    if tolerance < 0 or tolerance > Rational(1, 10):
        raise ValueError("INVALID_TOLERANCE")
    # A reference is exact even when learner answers allow rounding. Tolerance
    # cannot hide a wrong author answer key.
    if calculated != expected:
        raise ValueError("REFERENCE_VALUE_MISMATCH")
    constraints = exact_keys(spec.get("constraints", {}), set(), {"nonNegativeAnswer"})
    nonnegative = constraints.get(
        "nonNegativeAnswer", quantity in {"distance", "speed", "time"}
    )
    if not isinstance(nonnegative, bool) or (nonnegative and expected < 0):
        raise ValueError("INVALID_CONSTRAINT")
    return spec, tolerance


def verify_physics(value: object) -> dict[str, Any]:
    revision = value.get("problemRevisionId") if isinstance(value, dict) else None
    result: dict[str, Any] = {
        "contractVersion": VERSION,
        "engineVersion": ENGINE,
        "problemRevisionId": revision if isinstance(revision, str) else "",
        "status": "invalid_input",
        "valueCorrect": None,
        "unitCorrect": None,
        "reasonCode": "INVALID_INPUT",
        "diagnosisCode": None,
    }
    try:
        data = exact_keys(
            value,
            {"contractVersion", "operation", "problemRevisionId", "reference"},
            {"answer"},
        )
        if data["contractVersion"] != VERSION:
            raise ValueError("UNSUPPORTED_CONTRACT")
        if not isinstance(revision, str) or not re.fullmatch(
            r"[A-Za-z0-9_-]{1,80}", revision
        ):
            raise ValueError("INVALID_REVISION")
        if data["operation"] not in {"validate_reference", "check_answer"}:
            raise ValueError("UNSUPPORTED_OPERATION")
        spec, tolerance = reference(data["reference"])
        if data["operation"] == "validate_reference":
            if "answer" in data:
                raise ValueError("INVALID_INPUT")
            result.update(
                status="correct",
                valueCorrect=True,
                unitCorrect=True,
                reasonCode="REFERENCE_VERIFIED",
            )
            return result
        answer = exact_keys(data.get("answer"), {"value", "unit"})
        entered = number(answer["value"])
        if not isinstance(answer["unit"], str) or len(answer["unit"]) > 16:
            raise ValueError("INVALID_UNIT")
        unit_name = ALIASES.get(answer["unit"], answer["unit"])
        unit = UNITS.get(unit_name)
        expected = number(spec["expectedValueSI"])
        if unit is None:
            result.update(
                status="wrong_unit",
                unitCorrect=False,
                reasonCode="MISSING_UNIT" if unit_name == "" else "UNSUPPORTED_UNIT",
            )
            return result
        unit_correct = unit[0] == spec["expectedDimension"]
        actual = entered * unit[1] if unit_correct else entered
        value_correct = abs(actual - expected) <= tolerance
        nonnegative = spec.get("constraints", {}).get(
            "nonNegativeAnswer", spec["quantity"] in {"distance", "speed", "time"}
        )
        if nonnegative and actual < 0:
            value_correct = False
        result.update(valueCorrect=bool(value_correct), unitCorrect=unit_correct)
        if not unit_correct:
            result.update(
                status="wrong_unit",
                reasonCode="DIMENSION_MISMATCH",
                diagnosisCode=(
                    "speed_distance_confusion"
                    if {unit[0], spec["expectedDimension"]} == {"length", "speed"}
                    else None
                ),
            )
        elif value_correct:
            result.update(status="correct", reasonCode="VALUE_AND_UNIT_VERIFIED")
        else:
            diagnosis = None
            if actual == -expected and expected != 0:
                diagnosis = "sign_or_acceleration"
            elif unit_name == "km/h" and abs(entered - expected) <= tolerance:
                diagnosis = "unit_conversion"
            # Formula choice cannot be inferred from a wrong scalar alone.
            result.update(
                status="wrong_value",
                reasonCode="VALUE_MISMATCH",
                diagnosisCode=diagnosis,
            )
        return result
    except (ValueError, TypeError, KeyError, ZeroDivisionError) as exc:
        reason = str(exc)
        allowed = {"UNSUPPORTED_TOPIC", "UNSUPPORTED_CONTRACT", "UNSUPPORTED_OPERATION"}
        result["status"] = "unsupported" if reason in allowed else "invalid_input"
        result["reasonCode"] = (
            reason if re.fullmatch(r"[A-Z_]{1,80}", reason) else "INVALID_INPUT"
        )
        return result
