"""Structural P0 guards, exact rational arithmetic and independent SymPy check."""

from dataclasses import dataclass
from fractions import Fraction

import sympy as sp

from .model import Budget, MathFailure, Node, Object

VARIABLE = sp.Symbol("س", real=True)


def rational(value: Fraction) -> Object:
    return {"num": str(value.numerator), "den": str(value.denominator)}


@dataclass(frozen=True)
class Linear:
    a: Fraction
    b: Fraction


@dataclass(frozen=True)
class Solution:
    kind: str
    value: Fraction | None = None

    def wire(self) -> Object:
        return {
            "kind": self.kind,
            "value": rational(self.value) if self.value is not None else None,
        }

    def contains(self, value: Fraction) -> bool:
        return (
            self.kind == "all_reals" or self.kind == "singleton" and self.value == value
        )


def bounded(value: Fraction, budget: Budget) -> Fraction:
    budget.tick()
    if (
        max(abs(value.numerator).bit_length(), value.denominator.bit_length())
        > budget.limits.rational_bits
    ):
        raise MathFailure(
            "inconclusive",
            "RESOURCE_RATIONAL_LIMIT",
            "تجاوز الحساب حد الأعداد النسبية التجريبي؛ لم نصدر حكمًا.",
        )
    return value


def coefficients(node: Node, budget: Budget) -> Linear:
    budget.tick()
    if node.kind == "Integer":
        return Linear(Fraction(0), Fraction(node.value))
    if node.kind == "Variable":
        return Linear(Fraction(1), Fraction(0))
    assert node.left is not None
    if node.kind == "Negate":
        child = coefficients(node.left, budget)
        return Linear(-child.a, -child.b)
    assert node.right is not None
    # Guard the original structure, even when a factor would cancel to zero.
    if node.kind == "Multiply" and node.left.has_variable and node.right.has_variable:
        raise MathFailure(
            "unsupported",
            "NONLINEAR_EXPRESSION",
            "ضرب تعبيرين يحتويان س خارج نطاق المسار.",
            node.span.start,
            node.span.end,
        )
    if node.kind == "Divide" and node.right.has_variable:
        raise MathFailure(
            "unsupported",
            "VARIABLE_DENOMINATOR",
            "المقام الذي يحتوي متغيرًا غير مدعوم، حتى لو أمكن اختزاله.",
            node.right.extent.start,
            node.right.extent.end,
        )
    left = coefficients(node.left, budget)
    right = coefficients(node.right, budget)
    if node.kind == "Add":
        a, b = left.a + right.a, left.b + right.b
    elif node.kind in ("Subtract", "Equation"):
        a, b = left.a - right.a, left.b - right.b
    elif node.kind == "Multiply":
        a = bounded(left.a * right.b, budget) + bounded(left.b * right.a, budget)
        b = left.b * right.b
    elif node.kind == "Divide":
        if right.b == 0:
            raise MathFailure(
                "syntax_error",
                "DIVISION_BY_ZERO",
                "لا يمكن القسمة على صفر. راجع المقام.",
                node.right.extent.start,
                node.right.extent.end,
            )
        a, b = left.a / right.b, left.b / right.b
    else:
        raise ValueError("unknown internal node")
    return Linear(bounded(a, budget), bounded(b, budget))


def solution_of(linear: Linear, budget: Budget) -> Solution:
    if linear.a:
        return Solution("singleton", bounded(-linear.b / linear.a, budget))
    return Solution("all_reals" if linear.b == 0 else "empty")


def symbolic(node: Node) -> sp.Expr:
    # Constructors receive trusted integers/children only, never raw source.
    if node.kind == "Integer":
        return sp.Integer(node.value)
    if node.kind == "Variable":
        return VARIABLE
    assert node.left is not None
    left = symbolic(node.left)
    if node.kind == "Negate":
        return -left
    assert node.right is not None
    right = symbolic(node.right)
    if node.kind == "Add":
        return sp.Add(left, right)
    if node.kind in ("Subtract", "Equation"):
        return sp.Add(left, -right)
    if node.kind == "Multiply":
        return sp.Mul(left, right)
    if node.kind == "Divide":
        return left / right
    raise ValueError("unknown internal node")


def reference_check(
    root: Node, linear: Linear, solution: Solution, budget: Budget
) -> sp.Expr:
    budget.tick()
    expression = symbolic(root)
    expanded = sp.expand(expression)
    expected_a = sp.Rational(linear.a.numerator, linear.a.denominator)
    expected_b = sp.Rational(linear.b.numerator, linear.b.denominator)
    expected_set = sp.S.Reals if solution.kind == "all_reals" else sp.S.EmptySet
    if solution.value is not None:
        expected_set = sp.FiniteSet(
            sp.Rational(solution.value.numerator, solution.value.denominator)
        )
    actual_set = sp.solveset(expression, VARIABLE, domain=sp.S.Reals)
    budget.tick()
    if (
        expanded.coeff(VARIABLE) != expected_a
        or expanded.subs(VARIABLE, 0) != expected_b
        or actual_set != expected_set
    ):
        raise MathFailure(
            "inconclusive",
            "REFERENCE_DISAGREEMENT",
            "اختلف مسارا الحساب؛ امتنعنا عن إصدار حكم قطعي.",
        )
    return expression
