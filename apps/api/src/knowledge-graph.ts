import { createHash } from "node:crypto";
import type {
  LearningContentRevision,
  LearningSkillMap,
} from "../../../packages/contracts/src/learning-paths";
import type { SubjectCode } from "../../../packages/contracts/src/product";

export const GRAPH_VERSION = "knowledge-a4-v1";
export interface GraphEdge {
  fromSkill: string;
  toSkill: string;
  relationKind: "required" | "helpful" | "cross_subject_support";
  rationaleAr: string;
  reviewState: "reviewed" | "pending";
}
export interface GraphNode {
  skillCode: string;
  titleAr: string;
  subject: SubjectCode;
  lessonRevisionId: string | null;
  reviewState: "reviewed" | "mapping_pending" | "missing_coverage";
}
export interface KnowledgeGraph {
  trackRevisionId: string;
  graphVersion: string;
  mappingSnapshotHash: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  issues: string[];
}
export function validateGraph(
  nodes: readonly { skillCode: string }[],
  edges: readonly GraphEdge[],
): string[] {
  const issues: string[] = [],
    known = new Set(nodes.map((n) => n.skillCode));
  for (const edge of edges)
    if (!known.has(edge.fromSkill) || !known.has(edge.toSkill))
      issues.push(`missing_node:${edge.fromSkill}->${edge.toSkill}`);
  const complete = new Set<string>(),
    visiting: string[] = [];
  const visit = (skill: string) => {
    const index = visiting.indexOf(skill);
    if (index >= 0) {
      issues.push("cycle:" + [...visiting.slice(index), skill].join("->"));
      return;
    }
    if (complete.has(skill)) return;
    visiting.push(skill);
    for (const e of edges.filter(
      (e) =>
        e.fromSkill === skill &&
        e.relationKind === "required" &&
        e.reviewState === "reviewed",
    ))
      visit(e.toSkill);
    visiting.pop();
    complete.add(skill);
  };
  for (const node of nodes) visit(node.skillCode);
  return [...new Set(issues)];
}
export function prerequisiteClosure(
  skillCode: string,
  graph: KnowledgeGraph,
  maxDepth = 8,
): {
  skillCode: string;
  depth: number;
  relationKind: GraphEdge["relationKind"];
}[] {
  const seen = new Set([skillCode]),
    result: {
      skillCode: string;
      depth: number;
      relationKind: GraphEdge["relationKind"];
    }[] = [],
    queue = [{ skillCode, depth: 0 }];
  while (queue.length) {
    const item = queue.shift()!;
    if (item.depth >= maxDepth) continue;
    for (const edge of graph.edges
      .filter(
        (e) => e.fromSkill === item.skillCode && e.reviewState === "reviewed",
      )
      .sort((a, b) => a.toSkill.localeCompare(b.toSkill))) {
      if (seen.has(edge.toSkill)) continue;
      seen.add(edge.toSkill);
      result.push({
        skillCode: edge.toSkill,
        depth: item.depth + 1,
        relationKind: edge.relationKind,
      });
      queue.push({ skillCode: edge.toSkill, depth: item.depth + 1 });
    }
  }
  return result;
}
export function buildKnowledgeGraph(
  trackRevisionId: string,
  subject: SubjectCode,
  map: LearningSkillMap,
  lessons: LearningContentRevision[],
  relationEdges: GraphEdge[] = [],
): KnowledgeGraph {
  const allowed = new Set(
    lessons.flatMap((l) =>
      l.payload.kind === "lesson"
        ? [...l.payload.skillCodes, ...l.payload.prerequisiteSkillCodes]
        : [],
    ),
  );
  const nodes: GraphNode[] = map.skills
    .filter((s) => allowed.has(s.skillCode))
    .map((s): GraphNode => {
      const lesson = lessons.find(
        (l) =>
          l.id === s.lessonRevisionId &&
          l.status === "published" &&
          l.payload.kind === "lesson",
      );
      return {
        skillCode: s.skillCode,
        titleAr: s.titleAr,
        subject,
        lessonRevisionId: lesson?.id ?? null,
        reviewState:
          lesson?.payload.kind === "lesson" &&
          lesson.payload.mappingPending.length
            ? "mapping_pending"
            : lesson
              ? "reviewed"
              : "missing_coverage",
      };
    })
    .sort((a, b) => a.skillCode.localeCompare(b.skillCode));
  // Canonical relation_kind matters: helpful edges never become required gates.
  const edges = relationEdges
    .filter((e) => allowed.has(e.fromSkill) && allowed.has(e.toSkill))
    .sort(
      (a, b) =>
        a.fromSkill.localeCompare(b.fromSkill) ||
        a.toSkill.localeCompare(b.toSkill),
    );
  for (const lesson of lessons)
    if (lesson.payload.kind === "lesson" && lesson.status === "published")
      for (const skill of lesson.payload.skillCodes)
        for (const prerequisite of lesson.payload.prerequisiteSkillCodes)
          if (
            !edges.some(
              (e) => e.fromSkill === skill && e.toSkill === prerequisite,
            )
          )
            edges.push({
              fromSkill: skill,
              toSkill: prerequisite,
              relationKind: "required",
              rationaleAr: "متطلب مثبت في نسخة الدرس المنشورة.",
              reviewState: lesson.payload.mappingPending.length
                ? "pending"
                : "reviewed",
            });
  const issues = validateGraph(nodes, edges);
  return {
    trackRevisionId,
    graphVersion: GRAPH_VERSION,
    mappingSnapshotHash: createHash("sha256")
      .update(
        JSON.stringify({
          nodes,
          edges,
          versions: lessons.map((l) => [l.id, l.contentHash]),
        }),
      )
      .digest("hex"),
    nodes,
    edges,
    issues,
  };
}
