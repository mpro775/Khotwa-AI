"""Allowlisted Arabic/ASCII tokens with original code point spans."""

import unicodedata
from dataclasses import dataclass

from .model import Budget, MathFailure, complexity

DIGITS = "0123456789٠١٢٣٤٥٦٧٨٩"
SPACE = " \t\n\r\u00a0\u202f"
ALIASES = {"−": "-", "×": "*", "÷": "/"}
FUNCTIONS = ("جتا", "جا", "ظا", "sin", "cos", "tan", "log")


@dataclass(frozen=True)
class Token:
    kind: str
    text: str
    start: int
    end: int


def tokenize(raw: str, budget: Budget) -> list[Token]:
    budget.tick()
    if len(raw) > budget.limits.input_points:
        raise complexity(256, len(raw))
    for i, char in enumerate(raw):
        if unicodedata.category(char) in ("Cc", "Cf", "Cs") and char not in SPACE:
            raise MathFailure(
                "syntax_error",
                "UNSAFE_CONTROL_CHARACTER",
                "يوجد محرف تحكم خفي أو غير صالح. راجع الموضع دون تغيير خفي للنص.",
                i,
                i + 1,
            )
    result: list[Token] = []
    i = 0
    while i < len(raw):
        budget.tick()
        char = raw[i]
        if char in SPACE:
            i += 1
            continue
        start = i
        if char in DIGITS:
            while i < len(raw) and raw[i] in DIGITS:
                i += 1
            if i - start > budget.limits.integer_digits:
                raise complexity(start, i)
            text = "".join(str(DIGITS.index(c) % 10) for c in raw[start:i])
            result.append(Token("int", text, start, i))
        elif char == "س" or char in "+-−×*÷/=()":
            result.append(Token(ALIASES.get(char, char), char, i, i + 1))
            i += 1
        else:
            function = next((f for f in FUNCTIONS if raw.startswith(f, i)), None)
            if function:
                raise MathFailure(
                    "unsupported",
                    "UNSUPPORTED_FUNCTION",
                    "الدوال غير مدعومة في مسار الجبر الخطي الحالي.",
                    i,
                    i + len(function),
                )
            if char in "^²³⁰¹⁴⁵⁶⁷⁸⁹":
                code, message = "UNSUPPORTED_POWER", "الأسس خارج نطاق هذا المسار."
            elif char in ".٫٬" or char in "۰۱۲۳۴۵۶۷۸۹":
                code = "UNSUPPORTED_DECIMAL"
                message = "صيغة العدد غير مدعومة؛ لم نحذف فاصلة أو نغير الرقم."
            elif char.isalpha() and not ("\ufb50" <= char <= "\ufeff"):
                code, message = "UNSUPPORTED_VARIABLE", "المتغير المتاح هو س فقط."
            elif char in "√≤≥<>!%٪|":
                code, message = "UNSUPPORTED_SYMBOL", "هذا الرمز خارج نطاق المسار."
            else:
                raise MathFailure(
                    "syntax_error",
                    "INVALID_CHARACTER",
                    "تعذر فهم هذا المحرف. استخدم الرموز المعتمدة دون تشكيل أو تطويل.",
                    i,
                    i + 1,
                )
            raise MathFailure("unsupported", code, message, i, i + 1)
        if len(result) > budget.limits.tokens:
            raise complexity(start, i)
    result.append(Token("eof", "", len(raw), len(raw)))
    return result
