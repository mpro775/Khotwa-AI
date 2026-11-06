"""Recursive descent over the P0 grammar; never accepts client ASTs."""

from dataclasses import replace

from .lexer import Token, tokenize
from .model import Budget, MathFailure, Node, Span, complexity


class Parser:
    def __init__(self, raw: str, budget: Budget) -> None:
        self.raw, self.budget = raw, budget
        self.tokens = tokenize(raw, budget)
        self.position = 0
        self.count = 0
        self.depth = 0

    @property
    def current(self) -> Token:
        return self.tokens[self.position]

    def take(self) -> Token:
        token = self.current
        self.position += 1
        return token

    def fail(self, code: str, message: str, status: str = "syntax_error") -> None:
        t = self.current
        raise MathFailure(status, code, message, t.start, t.end)

    def binary(
        self, kind: str, left: Node, right: Node, implicit: bool = False
    ) -> Node:
        self.count += 1
        if self.count > self.budget.limits.nodes:
            raise complexity(left.extent.start, right.extent.end)
        return Node(
            kind,
            Span(left.extent.start, right.extent.end),
            left,
            right,
            implicit=implicit,
        )

    def equation(self) -> Node:
        signs = [t for t in self.tokens if t.kind == "="]
        if len(signs) > 1:
            t = signs[1]
            raise MathFailure(
                "syntax_error",
                "MULTIPLE_EQUAL_SIGNS",
                "اكتب معادلة واحدة بعلامة مساواة واحدة.",
                t.start,
                t.end,
            )
        if not signs:
            self.fail("MISSING_EQUAL_SIGN", "أكمل سطر المعادلة بعلامة مساواة.")
        left = self.expression()
        if self.current.kind != "=":
            self.fail("UNEXPECTED_ADJACENCY", "استخدم عملية صريحة أو راجع الأقواس.")
        self.take()
        right = self.expression()
        if self.current.kind != "eof":
            self.fail("UNBALANCED_PARENTHESIS", "راجع الأقواس والرموز المتبقية.")
        root = self.binary("Equation", left, right)
        root = replace(root, span=Span(0, len(self.raw)))
        self.check_depth(root)
        return root

    def check_depth(self, node: Node, depth: int = 1) -> None:
        self.budget.tick()
        if depth > self.budget.limits.depth:
            raise complexity(node.extent.start, node.extent.end)
        for child in (node.left, node.right):
            if child is not None:
                self.check_depth(child, depth + 1)

    def expression(self) -> Node:
        left = self.term()
        while self.current.kind in ("+", "-"):
            op = self.take()
            left = self.binary(
                "Add" if op.kind == "+" else "Subtract", left, self.term()
            )
        return left

    def term(self) -> Node:
        left = self.unary()
        while True:
            self.budget.tick()
            if self.current.kind in ("*", "/"):
                op = self.take()
                left = self.binary(
                    "Multiply" if op.kind == "*" else "Divide", left, self.unary()
                )
            elif self.current.kind in ("int", "س", "("):
                coefficient = (
                    left.kind == "Integer"
                    and not left.groups
                    or (
                        left.kind == "Negate"
                        and left.left is not None
                        and left.left.kind == "Integer"
                        and not left.left.groups
                        and not left.groups
                    )
                )
                if coefficient and self.current.kind in ("س", "("):
                    left = self.binary("Multiply", left, self.unary(), implicit=True)
                elif left.kind == "Divide":
                    self.fail("AMBIGUOUS_DIVISION", "أضف أقواسًا لتحديد البسط والمقام.")
                else:
                    unexpected = self.current
                    right = self.unary()
                    if left.has_variable and right.has_variable:
                        raise MathFailure(
                            "unsupported",
                            "NONLINEAR_EXPRESSION",
                            "ضرب تعبيرين متغيرين خارج النطاق.",
                            left.extent.start,
                            right.extent.end,
                        )
                    raise MathFailure(
                        "syntax_error",
                        "UNEXPECTED_ADJACENCY",
                        "استخدم علامة ضرب صريحة؛ لن نخمن التجاور.",
                        unexpected.start,
                        right.extent.end,
                    )
            else:
                return left

    def unary(self) -> Node:
        if self.current.kind in ("+", "-"):
            op = self.take()
            child = self.atom()  # One unary sign, as specified by doc 10 grammar.
            if op.kind == "+":
                return child
            self.count += 1
            return Node("Negate", Span(op.start, child.extent.end), left=child)
        return self.atom()

    def atom(self) -> Node:
        self.budget.tick()
        t = self.current
        if t.kind == "int" or t.kind == "س":
            self.take()
            self.count += 1
            return Node(
                "Integer" if t.kind == "int" else "Variable",
                Span(t.start, t.end),
                value=int(t.text) if t.kind == "int" else 0,
            )
        if t.kind == "(":
            self.take()
            self.depth += 1
            if self.depth > self.budget.limits.depth:
                raise complexity(t.start, t.end)
            child = self.expression()
            if self.current.kind != ")":
                raise MathFailure(
                    "syntax_error",
                    "UNBALANCED_PARENTHESIS",
                    "أكمل القوس المفتوح.",
                    t.start,
                    t.end,
                )
            closing = self.take()
            self.depth -= 1
            return replace(child, groups=(*child.groups, Span(t.start, closing.end)))
        self.fail("INCOMPLETE_EXPRESSION", "أكمل العدد أو المتغير أو الطرف الناقص.")
        raise AssertionError("unreachable")


def parse(raw: str, budget: Budget | None = None) -> Node:
    return Parser(raw, budget or Budget()).equation()
