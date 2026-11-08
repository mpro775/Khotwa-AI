"""Bounded test-only exact oracle for Node graph generation; no service starts."""

import json
import sys
from fractions import Fraction


def points(model):
    numbers = {
        key: Fraction(str(model[key])) for key in ("a", "b", "xMin", "xMax", "step")
    }
    start, end, step = (numbers[key] for key in ("xMin", "xMax", "step"))
    if step <= 0 or start >= end or (end - start) / step > 100:
        raise ValueError("bounded oracle models required")
    result = []
    value = start
    while value <= end:
        result.append(
            {
                "x": float(value),
                "y": float(numbers["a"] * value + numbers["b"]),
            }
        )
        value += step
    return result


if __name__ == "__main__":
    data = json.loads(sys.stdin.read(32769))
    if not isinstance(data, list) or not 1 <= len(data) <= 24:
        raise ValueError("bounded oracle input required")
    print(json.dumps([points(model) for model in data]))
