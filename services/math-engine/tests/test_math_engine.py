import ast
import tempfile
import time
import unittest
from fractions import Fraction
from pathlib import Path
from unittest.mock import patch

import sympy as sp

from khotwa_math.engine import analyze, compare, isolated
from khotwa_math.lexer import tokenize
from khotwa_math.model import Budget, MathFailure, Node
from khotwa_math.parser import parse
from khotwa_math.protocol import execute, validate_request
from helpers import payload


class MathTests(unittest.TestCase):
    def rejected(self, raw: str, status: str, reason: str | None = None) -> None:
        with self.assertRaises(MathFailure) as caught:
            analyze(raw)
        self.assertEqual(caught.exception.status, status)
        if reason:
            self.assertEqual(caught.exception.code, reason)

    def test_unicode_digits_signs_and_multi_digit_token(self) -> None:
        tokens = tokenize("٢٣س=-3", Budget())
        self.assertEqual([t.kind for t in tokens], ["int", "س", "=", "-", "int", "eof"])
        self.assertEqual(tokens[0].text, "23")
        self.assertEqual((tokens[0].start, tokens[0].end), (0, 2))
        self.assertEqual(analyze("٢٣س=-3").solution.value, Fraction(-3, 23))

    def test_raw_and_display_are_independent(self) -> None:
        raw = " 2(س + 3) = 10 "
        result = analyze(raw)
        self.assertEqual(result.raw, raw)
        self.assertEqual(result.display, "٢(س + ٣) = ١٠")
        self.assertEqual(result.normalized, "2 * (س + 3) = 10")
        self.assertEqual(result.root.left.kind, "Multiply")
        self.assertTrue(result.root.left.implicit)

    def test_source_spans_and_groups(self) -> None:
        raw = " ٢((س + ٣)) = ١٠ "
        root = parse(raw)

        def inspect(node: Node, low: int, high: int) -> None:
            self.assertTrue(
                low
                <= node.extent.start
                <= node.span.start
                <= node.span.end
                <= node.extent.end
                <= high
            )
            for group in node.groups:
                self.assertEqual(raw[group.start], "(")
                self.assertEqual(raw[group.end - 1], ")")
            for child in (node.left, node.right):
                if child is not None:
                    inspect(child, node.span.start, node.span.end)

        inspect(root, 0, len(raw))
        self.assertEqual(root.left.right.span.start, 4)
        self.assertEqual(len(root.left.right.groups), 2)

    def test_control_spans_are_code_points(self) -> None:
        for control in (
            "\u200e",
            "\u200f",
            "\u202e",
            "\u2066",
            "\u2069",
            "\u200d",
            "\x00",
        ):
            with self.subTest(control=ascii(control)):
                with self.assertRaises(MathFailure) as caught:
                    analyze("س" + control + "=٢")
                self.assertEqual(caught.exception.code, "UNSAFE_CONTROL_CHARACTER")
                self.assertEqual((caught.exception.start, caught.exception.end), (1, 2))

    def test_adjacency_issue_points_to_offending_term(self) -> None:
        for raw, expected in (
            ("٢س٣=٦", (2, 3)),
            ("س(٢)=٤", (1, 4)),
            ("(س+١)(س+٢)=٠", (0, 10)),
        ):
            with self.assertRaises(MathFailure) as caught:
                analyze(raw)
            self.assertEqual((caught.exception.start, caught.exception.end), expected)

    def test_no_silent_aliases(self) -> None:
        for raw in ("x=2", "ص=٢", "سَ=٢", "ﺱ=٢", "سـ=٢", "س=۱", "3.5س=7", "١،٥س=٣"):
            with self.subTest(raw=raw):
                with self.assertRaises(MathFailure):
                    analyze(raw)

    def test_functions_and_powers_abstain(self) -> None:
        for raw in ("جا(٣٠°)=١/٢", "جتا(٦٠°)=١/٢", "sin(30)=1/2"):
            self.rejected(raw, "unsupported", "UNSUPPORTED_FUNCTION")
        self.rejected("س²+١=٠", "unsupported", "UNSUPPORTED_POWER")

    def test_ambiguous_adjacency_and_incomplete_equations(self) -> None:
        self.rejected("−(٢)س=٤", "syntax_error", "UNEXPECTED_ADJACENCY")
        for raw, reason in (
            ("١/٢س=٣", "AMBIGUOUS_DIVISION"),
            ("٢س٣=٦", "UNEXPECTED_ADJACENCY"),
            ("س(٢)=٤", "UNEXPECTED_ADJACENCY"),
            ("س=٢=٣", "MULTIPLE_EQUAL_SIGNS"),
            ("٢(س+٣=١٠", "UNBALANCED_PARENTHESIS"),
            ("٢س+٣", "MISSING_EQUAL_SIGN"),
        ):
            self.rejected(raw, "syntax_error", reason)
        for raw in ("", "=", "س=", "س+=٢", "س=()", "س=٢)٣"):
            self.rejected(raw, "syntax_error")

    def test_variable_denominator_before_cancellation(self) -> None:
        for raw in ("س/س=١", "١/(س-س+١)=٢", "٠/س=٠"):
            self.rejected(raw, "unsupported", "VARIABLE_DENOMINATOR")

    def test_nonlinearity_before_zero_or_cancellation(self) -> None:
        for raw in ("س×س=٤", "٠×س×س=٠", "(س-س)×س=٠", "(س+١)(س+٢)=٠"):
            self.rejected(raw, "unsupported", "NONLINEAR_EXPRESSION")

    def test_division_by_zero_in_arithmetic_denominator(self) -> None:
        for raw in ("س/٠=٢", "س/(٢-٢)=١", "س/(١/(٣-٣))=١"):
            self.rejected(raw, "syntax_error", "DIVISION_BY_ZERO")

    def test_rational_arithmetic_and_precedence(self) -> None:
        for raw, answer in (
            ("٢س/٣=٤", Fraction(6)),
            ("س=-٧/٣", Fraction(-7, 3)),
            ("(١/٢)×س=٣", Fraction(6)),
            ("٢*(س+٣)/٤=٥", Fraction(7)),
            ("س=١/٢/٣", Fraction(1, 6)),
            ("س=١/(٢/٣)", Fraction(3, 2)),
        ):
            self.assertEqual(analyze(raw).solution.value, answer)

    def test_multiple_valid_routes_and_signs(self) -> None:
        original = "٢(س+٣)=١٠"
        for next_raw in ("٢س+٦=١٠", "س+٣=٥", "س=٢", "٢=س", "٦+٢س=١٠"):
            self.assertEqual(compare(original, next_raw).status, "verified_valid")
        self.assertEqual(compare("−٢(س−٣)=١٠", "−٢س+٦=١٠").status, "verified_valid")
        self.assertEqual(compare("−٢(س−٣)=١٠", "−٢س−٦=١٠").status, "verified_invalid")

    def test_all_empty_singleton_and_witnesses(self) -> None:
        lines = ["س=٠", "س=١", "٠=٠", "٠=١"]
        for before in lines:
            for after in lines:
                result = compare(before, after)
                old, new = result.before.solution, result.after.solution
                self.assertEqual(result.status == "verified_valid", old == new)
                if old != new:
                    witness = result.evidence["witness"]
                    self.assertIsInstance(witness, dict)
                    value = witness["value"]
                    number = Fraction(int(value["num"]), int(value["den"]))
                    self.assertNotEqual(old.contains(number), new.contains(number))

    def test_real_difference_not_one_sample_or_text(self) -> None:
        self.assertEqual(compare("٢س=٤", "٠=٠").status, "verified_invalid")
        self.assertEqual(compare("س+٣=٧", "٢س+٦=١٤").status, "verified_valid")
        self.assertEqual(compare("٠=٣", "٠=٤").status, "verified_valid")

    def test_isolation_is_separate_from_equivalence(self) -> None:
        self.assertFalse(isolated(analyze("٢س=٤"), Budget())[0])
        self.assertEqual(isolated(analyze("٢=س"), Budget()), (True, Fraction(2)))
        self.assertEqual(isolated(analyze("س=١+١"), Budget()), (True, Fraction(2)))
        self.assertFalse(isolated(analyze("−س=−٢"), Budget())[0])

    def test_round_trip_and_source_structure(self) -> None:
        for raw in (
            "٢(س+٣)=١٠",
            "−٢(س−٣)=١٠",
            "س=١/(٢/٣)",
            "٢س/٣=٤",
            "س=−١/٢",
            "٢٣س=٤٦",
            "س=(١+٢)×٣",
        ):
            original = analyze(raw)
            for text in (original.display, original.normalized):
                result = analyze(text)
                self.assertEqual(result.linear, original.linear)
                self.assertEqual(result.solution, original.solution)

    def test_structural_limits(self) -> None:
        self.rejected("١" * 257, "unsupported", "RESOURCE_COMPLEXITY_LIMIT")
        self.rejected("س=" + "٩" * 19, "unsupported", "RESOURCE_COMPLEXITY_LIMIT")
        self.rejected(
            "س=" + "(" * 17 + "١" + ")" * 17, "unsupported", "RESOURCE_COMPLEXITY_LIMIT"
        )
        self.rejected(
            "س=" + "+".join(["١"] * 25), "unsupported", "RESOURCE_COMPLEXITY_LIMIT"
        )
        self.rejected(
            "س=" + "١+" * 100 + "١", "unsupported", "RESOURCE_COMPLEXITY_LIMIT"
        )
        self.assertEqual(analyze("س=" + "٩" * 18).solution.value, Fraction(10**18 - 1))

    def test_rational_limit_is_inconclusive(self) -> None:
        raw = "س=١" + ("/" + "٩" * 18) * 5
        self.rejected(raw, "inconclusive", "RESOURCE_RATIONAL_LIMIT")

    def test_soft_deadline_has_no_math_verdict(self) -> None:
        request = validate_request("parse", payload("parse"))
        result = execute(request, Budget(started=time.monotonic() - 2))
        self.assertEqual(result["parseStatus"], "service_error")
        self.assertEqual(result["reasonCode"], "MATH_TIMEOUT")
        self.assertIsNone(result["ast"])

    def test_reference_disagreement_abstains(self) -> None:
        with patch("khotwa_math.linear.sp.solveset", return_value=sp.S.EmptySet):
            result = execute(
                validate_request("verify-transition", payload("verify-transition"))
            )
        self.assertEqual(result["status"], "inconclusive")
        self.assertIsNone(result["evidence"])

    def test_bad_witness_abstains(self) -> None:
        with patch("khotwa_math.engine.satisfied", return_value=True):
            result = execute(
                validate_request(
                    "verify-transition", payload("verify-transition", "س=٢", "س=٣")
                )
            )
        self.assertEqual(result["status"], "inconclusive")
        self.assertIsNone(result["evidence"])

    def test_internal_failure_is_not_student_error(self) -> None:
        with patch(
            "khotwa_math.engine.compare", side_effect=RuntimeError("secret traceback")
        ):
            result = execute(
                validate_request("verify-transition", payload("verify-transition"))
            )
        self.assertEqual(result["status"], "service_error")
        self.assertNotIn("secret", str(result))

    def test_code_payloads_do_not_execute(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            marker = Path(folder) / "executed.txt"
            for raw in (
                "__import__('os').system('echo owned')=1",
                "\\href{evil}{س}=٢",
                "__import__('pathlib').Path('" + marker.as_posix() + "').touch()=1",
            ):
                with self.assertRaises(MathFailure):
                    analyze(raw)
            self.assertFalse(marker.exists())

    def test_source_has_no_unsafe_parsing_calls(self) -> None:
        root = Path(__file__).resolve().parents[1] / "src" / "khotwa_math"
        for file in root.glob("*.py"):
            tree = ast.parse(file.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    name = (
                        node.func.id
                        if isinstance(node.func, ast.Name)
                        else (
                            node.func.attr
                            if isinstance(node.func, ast.Attribute)
                            else ""
                        )
                    )
                    self.assertNotIn(
                        name,
                        {"eval", "exec", "sympify", "parse_expr", "parse_latex"},
                        file.name,
                    )

    def test_generated_equations_and_mutations(self) -> None:
        for a in (-5, -2, 1, 3, 7):
            for b in (-4, 0, 6):
                for solution in (-3, 0, 5):
                    # Explicit coefficient brackets avoid ambiguous unary signs.
                    original = f"({a})*س+({b})={a * solution + b}"
                    valid = f"س={solution}"
                    invalid = f"س={solution + 1}"
                    self.assertEqual(compare(original, valid).status, "verified_valid")
                    self.assertEqual(
                        compare(original, invalid).status, "verified_invalid"
                    )


if __name__ == "__main__":
    unittest.main()
