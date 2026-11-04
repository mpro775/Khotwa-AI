"""Generate text from the trusted AST; source text and visual order stay separate."""

from .model import Node

ARABIC = str.maketrans("0123456789-", "٠١٢٣٤٥٦٧٨٩−")
PRECEDENCE = {
    "Equation": 0,
    "Add": 10,
    "Subtract": 10,
    "Multiply": 20,
    "Divide": 20,
    "Negate": 30,
    "Integer": 40,
    "Variable": 40,
}


def render(node: Node, arabic: bool = True) -> str:
    if node.kind == "Integer":
        text = str(node.value)
    elif node.kind == "Variable":
        text = "س"
    elif node.kind == "Negate":
        assert node.left is not None
        part = render(node.left, arabic)
        if PRECEDENCE[node.left.kind] < 30 and not node.left.groups:
            part = "(" + part + ")"
        text = "-" + part
    else:
        assert node.left is not None and node.right is not None
        left, right = node.left, node.right
        a, b = render(left, arabic), render(right, arabic)
        precedence = PRECEDENCE[node.kind]
        if PRECEDENCE[left.kind] < precedence and not left.groups:
            a = "(" + a + ")"
        if (
            PRECEDENCE[right.kind] < precedence
            or (
                node.kind in ("Subtract", "Divide")
                and PRECEDENCE[right.kind] == precedence
            )
        ) and not right.groups:
            b = "(" + b + ")"
        if node.kind == "Multiply" and node.implicit and arabic:
            text = a + b
        elif node.kind == "Divide":
            # Parentheses prevent the ambiguous textual form 1/2س.
            if left.kind not in ("Integer", "Variable") and not left.groups:
                a = "(" + a + ")"
            if right.kind == "Negate" and not right.groups:
                b = "(" + b + ")"
            text = a + "/" + b
        else:
            op = {
                "Equation": "=",
                "Add": "+",
                "Subtract": "-",
                "Multiply": "×" if arabic else "*",
            }[node.kind]
            text = a + " " + op + " " + b
    if arabic:
        text = text.translate(ARABIC)
    for _ in node.groups:
        text = "(" + text + ")"
    return text
