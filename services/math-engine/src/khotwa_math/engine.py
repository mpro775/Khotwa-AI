"""Mathematical outcomes only: no diagnosis, mastery or completion decisions."""

from dataclasses import dataclass
from fractions import Fraction

import sympy as sp

from .linear import (
    VARIABLE,
    Linear,
    Solution,
    bounded,
    coefficients,
    rational,
    reference_check,
    solution_of,
)
from .model import Budget, MathFailure, Node, Object
from .parser import parse
from .render import render


@dataclass(frozen=True)
class Parsed:
    raw: str
    root: Node
    linear: Linear
    solution: Solution
    reference: sp.Expr

    @property
    def display(self) -> str:
        return render(self.root)

    @property
    def normalized(self) -> str:
        return render(self.root, arabic=False)


def analyze(raw: str, budget: Budget | None = None) -> Parsed:
    budget = budget or Budget()
    root = parse(raw, budget)
    linear = coefficients(root, budget)
    solution = solution_of(linear, budget)
    reference = reference_check(root, linear, solution, budget)
    return Parsed(raw, root, linear, solution, reference)


def satisfied(parsed: Parsed, value: Fraction, budget: Budget) -> bool:
    product = bounded(parsed.linear.a * value, budget)
    direct = bounded(product + parsed.linear.b, budget) == 0
    exact = sp.Rational(value.numerator, value.denominator)
    reference = parsed.reference.subs(VARIABLE, exact) == 0
    budget.tick()
    if bool(reference) != direct:
        raise MathFailure(
            "inconclusive",
            "EVIDENCE_CONSTRUCTION_FAILED",
            "تعذر تأكيد الشاهد بمسارين مستقلين.",
        )
    return direct


def make_evidence(before: Parsed, after: Parsed, budget: Budget) -> Object:
    evidence: Object = {
        "type": "solution_set",
        "domain": "reals",
        "previousSolution": before.solution.wire(),
        "nextSolution": after.solution.wire(),
        "witness": None,
    }
    if before.solution == after.solution:
        return evidence
    candidates = [
        v
        for v in (before.solution.value, after.solution.value, Fraction(0), Fraction(1))
        if v is not None
    ]
    for value in candidates:
        a, b = satisfied(before, value, budget), satisfied(after, value, budget)
        if a != b:
            evidence["type"] = "counterexample"
            evidence["witness"] = {
                "variable": "س",
                "value": rational(value),
                "satisfiesPrevious": a,
                "satisfiesNext": b,
            }
            return evidence
    raise MathFailure(
        "inconclusive",
        "EVIDENCE_CONSTRUCTION_FAILED",
        "تعذر بناء شاهد صالح؛ لم نحكم بعدم صحة الانتقال.",
    )


@dataclass(frozen=True)
class Comparison:
    before: Parsed
    after: Parsed
    evidence: Object

    @property
    def status(self) -> str:
        return (
            "verified_valid"
            if self.before.solution == self.after.solution
            else "verified_invalid"
        )


def compare(before: str, after: str, budget: Budget | None = None) -> Comparison:
    budget = budget or Budget()
    old, new = analyze(before, budget), analyze(after, budget)
    return Comparison(old, new, make_evidence(old, new, budget))


def isolated(parsed: Parsed, budget: Budget) -> tuple[bool, Fraction | None]:
    root = parsed.root
    assert root.left is not None and root.right is not None
    left, right = root.left, root.right
    if left.kind == "Variable" and not right.has_variable:
        return True, coefficients(right, budget).b
    if right.kind == "Variable" and not left.has_variable:
        return True, coefficients(left, budget).b
    return False, None
