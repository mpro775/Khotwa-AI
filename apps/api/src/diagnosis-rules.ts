import type { Schema } from "./contracts";

export const DIAGNOSIS_POLICY = "conservative-algebra-1.2.0";
export type ErrorCode = `ERR-ALG-0${1 | 2 | 3 | 4 | 5 | 6}`;
type Node = {
  type: string;
  value?: string;
  left?: Node;
  right?: Node;
  operand?: Node;
};
export interface Hypothesis {
  primary: ErrorCode | null;
  candidates: ErrorCode[];
  observation: string;
  family: string | null;
  state: "tentative" | "needs_probe" | "unresolved";
}
export interface VerifiedContextTransition {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  verdict: Pick<
    Schema<"TransitionVerdict">,
    "mathStatus" | "engineVersion" | "notationProfileVersion"
  >;
}
/** Context changes only the cautious causal interpretation. Every supporting
 * edge must already be proved by the same pinned engine/notation profile. */
export function contextualHypothesis(
  h: Hypothesis,
  preceding: readonly VerifiedContextTransition[],
  current: Pick<
    Schema<"TransitionVerdict">,
    "engineVersion" | "notationProfileVersion"
  >,
): { hypothesis: Hypothesis; supportingConcepts: string[] } {
  const concepts: string[] = [];
  for (const edge of preceding.slice(-2)) {
    if (
      edge.verdict.mathStatus !== "verified_valid" ||
      edge.verdict.engineVersion !== current.engineVersion ||
      edge.verdict.notationProfileVersion !== current.notationProfileVersion
    )
      continue;
    const before = root(edge.before),
      after = root(edge.after);
    if (!before || !after) continue;
    if (same(before, after)) continue;
    const [a, b] = oriented(before),
      [c, d] = oriented(after);
    const factor =
      a.type === "Multiply" ? (integer(a.left) ?? integer(a.right)) : null;
    const inside =
      a.type === "Multiply"
        ? integer(a.left) !== null
          ? a.right
          : a.left
        : undefined;
    const innerPair = inside ? pair(inside) : null,
      expandedPair = pair(c);
    if (
      factor !== null &&
      factor !== 1n &&
      innerPair &&
      expandedPair &&
      expandedPair[0] === factor * innerPair[0] &&
      expandedPair[1] === factor * innerPair[1] &&
      same(b, d)
    )
      concepts.push(factor < 0n ? "negative_distribution" : "distribution");
    const initialPair = pair(a),
      initialCoefficient = coefficient(a);
    if (
      (((initialPair && initialPair[1] !== 0n) ||
        (initialCoefficient !== null && initialCoefficient !== 1n)) &&
        variable(c) &&
        integer(d) !== null &&
        !variable(a)) ||
      (initialPair &&
        initialPair[1] !== 0n &&
        coefficient(c) === initialPair[0] &&
        integer(b) !== null &&
        integer(d) !== null)
    )
      concepts.push("inverse_operation");
    if (
      variable(a) &&
      variable(c) &&
      ["Add", "Subtract", "Multiply", "Divide"].includes(b.type) &&
      integer(b) !== null &&
      integer(d) !== null &&
      (d.type === "Integer" ||
        (d.type === "Negate" && d.operand?.type === "Integer"))
    )
      concepts.push("integer_arithmetic");
  }
  const relevant =
    h.primary === "ERR-ALG-01"
      ? concepts.includes("distribution") ||
        concepts.includes("negative_distribution")
      : h.primary === "ERR-ALG-06"
        ? concepts.includes("negative_distribution")
        : h.primary === "ERR-ALG-02" || h.primary === "ERR-ALG-04"
          ? concepts.includes("inverse_operation")
          : h.primary === "ERR-ALG-03"
            ? concepts.includes("inverse_operation")
            : h.primary === "ERR-ALG-05"
              ? concepts.includes("integer_arithmetic")
              : false;
  return {
    hypothesis: relevant
      ? {
          ...h,
          state: "tentative",
          observation:
            h.observation +
            " ظهرت في آخر خطوتين عملية من الفكرة نفسها ثبت تكافؤها؛ لذلك يبقى السهو المحلي تفسيرًا بديلًا مهمًا ولا نجزم بضعف المفهوم.",
        }
      : h,
    supportingConcepts: relevant ? [...new Set(concepts)] : [],
  };
}
const unknown = (): Hypothesis => ({
  primary: null,
  candidates: [],
  family: null,
  state: "unresolved",
  observation:
    "ثبت عدم تكافؤ الانتقال، لكن بنيته لا تكفي لتحديد سبب محتمل ضمن الأنماط المتاحة.",
});
// Structural observations only. These rules never solve equations or issue a verdict.
function node(value: unknown, budget = { n: 0 }, depth = 0): Node | null {
  if (!value || typeof value !== "object" || ++budget.n > 128 || depth > 16)
    return null;
  const v = value as Record<string, unknown>;
  if (
    v.type === "Integer" &&
    typeof v.value === "string" &&
    /^\d{1,18}$/.test(v.value)
  )
    return { type: v.type, value: v.value };
  if (v.type === "Variable" && v.name === "س") return { type: v.type };
  if (v.type === "Negate") {
    const operand = node(v.operand, budget, depth + 1);
    return operand ? { type: v.type, operand } : null;
  }
  if (
    ["Add", "Subtract", "Multiply", "Divide", "Equation"].includes(
      String(v.type),
    )
  ) {
    const left = node(v.left, budget, depth + 1),
      right = node(v.right, budget, depth + 1);
    return left && right ? { type: String(v.type), left, right } : null;
  }
  return null;
}
function root(ast: Record<string, unknown> | null): Node | null {
  if (ast?.schemaVersion !== "math-ast-v1") return null;
  const n = node(ast.root);
  return n?.type === "Equation" ? n : null;
}
const same = (a: Node | undefined, b: Node | undefined) =>
  !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
const variable = (n: Node | undefined) => n?.type === "Variable";
function integer(n: Node | undefined): bigint | null {
  if (!n) return null;
  if (n.type === "Integer") return BigInt(n.value!);
  if (n.type === "Negate") {
    const a = integer(n.operand);
    return a === null ? null : -a;
  }
  const a = integer(n.left),
    b = integer(n.right);
  if (a === null || b === null) return null;
  let result: bigint;
  switch (n.type) {
    case "Add":
      result = a + b;
      break;
    case "Subtract":
      result = a - b;
      break;
    case "Multiply":
      result = a * b;
      break;
    case "Divide":
      if (b === 0n || a % b !== 0n) return null;
      result = a / b;
      break;
    default:
      return null;
  }
  return result.toString(2).replace("-", "").length <= 256 ? result : null;
}
function coefficient(n: Node | undefined): bigint | null {
  if (variable(n)) return 1n;
  if (n?.type === "Negate") {
    const a = coefficient(n.operand);
    return a === null ? null : -a;
  }
  if (n?.type === "Multiply") {
    if (variable(n.right)) return integer(n.left);
    if (variable(n.left)) return integer(n.right);
  }
  return null;
}
function oriented(n: Node): [Node, Node] {
  // Merely permits reversed equation sides; no algebraic rearrangement.
  return integer(n.left) !== null && integer(n.right) === null
    ? [n.right!, n.left!]
    : [n.left!, n.right!];
}
function pair(n: Node): [bigint, bigint] | null {
  if (n.type !== "Add" && n.type !== "Subtract") return null;
  const a = coefficient(n.left),
    b = integer(n.right);
  if (a !== null && b !== null) return [a, n.type === "Subtract" ? -b : b];
  if (n.type === "Add") {
    const c = coefficient(n.right),
      d = integer(n.left);
    if (c !== null && d !== null) return [c, d];
  }
  return null;
}
function match(
  primary: ErrorCode,
  observation: string,
  family: string,
  candidates: ErrorCode[] = [primary],
): Hypothesis {
  return {
    primary,
    observation,
    family,
    candidates,
    state: primary === "ERR-ALG-03" ? "tentative" : "needs_probe",
  };
}
export function observeTransition(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  verdict: Pick<Schema<"TransitionVerdict">, "mathStatus" | "evidence">,
  priorPathValid: boolean,
): Hypothesis | null {
  const witness = verdict.evidence?.witness;
  if (
    !priorPathValid ||
    verdict.mathStatus !== "verified_invalid" ||
    !witness ||
    witness.satisfiesPrevious === witness.satisfiesNext
  )
    return null;
  const p = root(before),
    q = root(after);
  if (!p || !q) return null;
  const [a, b] = oriented(p),
    [c, d] = oriented(q);
  if (same(b, d) && a.type === "Multiply") {
    const factor = integer(a.left) ?? integer(a.right);
    const inside = integer(a.left) !== null ? a.right : a.left;
    const initial = inside ? pair(inside) : null,
      expanded = pair(c);
    if (
      factor !== null &&
      initial &&
      expanded &&
      expanded[0] === factor * initial[0]
    ) {
      if (
        factor < 0n &&
        (expanded[1] === -(factor * initial[1]) || expanded[1] === initial[1])
      )
        return match(
          "ERR-ALG-06",
          "ظهر توزيع بمعامل سالب، لكن الحد الثابت لا يحمل أثر الإشارة المتوقع؛ قد يتعلق الأمر بالإشارة أو بالتوزيع.",
          "negative_product",
          ["ERR-ALG-06", "ERR-ALG-01"],
        );
      if (factor !== 1n && expanded[1] === initial[1])
        return match(
          "ERR-ALG-01",
          "تغير الحد الذي يحوي س بضرب المعامل، بينما بقي الحد الثابت داخل القوس دون الضرب نفسه؛ قد يكون ذلك سهوًا أو توزيعًا غير مكتمل.",
          "distribution",
        );
    }
  }
  if (
    variable(a) &&
    variable(c) &&
    ["Add", "Subtract", "Multiply", "Divide"].includes(b.type) &&
    integer(b) !== null &&
    integer(d) !== null
  )
    return match(
      "ERR-ALG-05",
      "كانت العملية العددية مكتوبة بعد عزل س، ثم تغيرت قيمتها عند الحساب؛ لا يدل ذلك وحده على ضعف مفاهيمي.",
      b.type === "Divide"
        ? "calculation_divide"
        : b.type === "Add" && (integer(b.left) ?? 0n) < 0n
          ? "calculation_signed"
          : "calculation",
    );
  if (
    variable(c) &&
    (a.type === "Add" || a.type === "Subtract") &&
    variable(a.left) &&
    integer(a.right) !== null &&
    d.type === a.type &&
    same(b, d.left) &&
    same(a.right, d.right)
  ) {
    if (a.type === "Subtract" || (integer(a.right) ?? 0n) < 0n)
      return match(
        "ERR-ALG-02",
        "ظهرت إشارة عملية لا تعكس إزالة الحد الثابت؛ يظل التباس الإشارة واختيار العملية العكسية فرضيتين ممكنتين.",
        "inverse_add",
        ["ERR-ALG-02", "ERR-ALG-04"],
      );
    return match(
      "ERR-ALG-04",
      "استُخدمت العملية نفسها بدل عكسها في محاولة عزل س؛ يلزم سؤال إضافي لتمييز الاختيار من السهو.",
      "inverse_add",
    );
  }
  const factor = coefficient(a),
    rhs = integer(b);
  if (
    variable(c) &&
    factor !== null &&
    factor !== 0n &&
    rhs !== null &&
    ((d.type === "Multiply" &&
      ((integer(d.left) === factor && integer(d.right) === rhs) ||
        (integer(d.right) === factor && integer(d.left) === rhs))) ||
      (d.type === "Divide" &&
        integer(d.left) === factor &&
        integer(d.right) === rhs))
  )
    return match(
      "ERR-ALG-04",
      "ظهر ضرب بدل قسمة، أو عكس ترتيب القسمة، عند إزالة معامل س؛ هذه قرينة على إجراء محتمل وليست حكمًا على فهم الطالب.",
      "inverse_multiply",
    );
  if (
    (same(a, c) && integer(b) !== null && integer(d) !== null) ||
    (same(b, d) &&
      ["Add", "Subtract"].includes(a.type) &&
      same(a.left, c) &&
      integer(a.right) !== null)
  )
    return match(
      "ERR-ALG-03",
      "تغير طرف من المساواة دون أثر مقابل ظاهر في الطرف الآخر؛ ربما حُذفت كتابة أو نُفذت عملية على طرف واحد.",
      "balance",
    );
  return unknown();
}
