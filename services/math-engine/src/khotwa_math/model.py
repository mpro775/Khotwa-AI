"""Owned AST vocabulary and bounded, JSON-only internal results."""

from dataclasses import dataclass, field
from time import monotonic
from typing import TypeAlias

Json: TypeAlias = None | bool | int | str | list["Json"] | dict[str, "Json"]
Object: TypeAlias = dict[str, Json]


class MathFailure(Exception):
    def __init__(
        self,
        status: str,
        code: str,
        message: str,
        start: int | None = None,
        end: int | None = None,
    ) -> None:
        super().__init__(code)
        self.status, self.code, self.message = status, code, message
        self.start, self.end = start, end

    def issue(self) -> Object:
        return {
            "reasonCode": self.code,
            "messageAr": self.message,
            "spanStart": self.start,
            "spanEnd": self.end,
            "spanUnit": "unicode_codepoint",
            "hintKey": None,
        }


@dataclass(frozen=True)
class Limits:
    """Measured prototype guards from doc 10 §15.3, not final release policy."""

    input_points: int = 256
    tokens: int = 128
    depth: int = 16
    nodes: int = 128
    integer_digits: int = 18
    rational_bits: int = 256
    compute_seconds: float = 1.0


LIMITS = Limits()


@dataclass
class Budget:
    limits: Limits = LIMITS
    started: float = field(default_factory=monotonic)

    def tick(self) -> None:
        if monotonic() - self.started > self.limits.compute_seconds:
            raise MathFailure(
                "service_error", "MATH_TIMEOUT", "تعذر التحقق خلال المهلة المحددة."
            )


@dataclass(frozen=True)
class Span:
    start: int
    end: int

    def wire(self) -> Object:
        return {"start": self.start, "end": self.end, "unit": "unicode_codepoint"}


@dataclass(frozen=True)
class Node:
    kind: str
    span: Span
    left: "Node | None" = None
    right: "Node | None" = None
    value: int = 0
    groups: tuple[Span, ...] = ()
    implicit: bool = False

    @property
    def extent(self) -> Span:
        return self.groups[-1] if self.groups else self.span

    @property
    def has_variable(self) -> bool:
        return (
            self.kind == "Variable"
            or self.left is not None
            and self.left.has_variable
            or self.right is not None
            and self.right.has_variable
        )

    def wire(self) -> Object:
        result: Object = {"type": self.kind, "sourceSpan": self.span.wire()}
        if self.groups:
            result["groupSpans"] = [s.wire() for s in self.groups]
        if self.kind == "Integer":
            result["value"] = str(self.value)
        elif self.kind == "Variable":
            result["name"] = "س"
        elif self.kind == "Negate":
            assert self.left is not None
            result["operand"] = self.left.wire()
        else:
            assert self.left is not None and self.right is not None
            result["left"], result["right"] = self.left.wire(), self.right.wire()
            if self.kind == "Multiply":
                result["implicit"] = self.implicit
        return result


def complexity(start: int | None = None, end: int | None = None) -> MathFailure:
    return MathFailure(
        "unsupported",
        "RESOURCE_COMPLEXITY_LIMIT",
        "تجاوزت الصيغة حد التعقيد التجريبي؛ جرّب سطرًا أقصر.",
        start,
        end,
    )
