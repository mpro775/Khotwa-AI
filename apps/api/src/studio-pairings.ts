import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type {
  ContentPayload,
  ContentValidation,
} from "../../../packages/contracts/src/product";
import { ApiFault } from "./http";
import { parsePayload } from "./content-payload";
import { materializeStudioHints, studioHintIssues } from "./studio-tutoring";

export interface StudioPairingSource {
  id: string;
  item_id: string;
  payload: ContentPayload;
  content_hash: string;
  validation: ContentValidation | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  published_at: Date | null;
}
/** Exposure identity only: this normalization never issues a mathematical
 * verdict. It catches display-only copies, including eastern digits, reversed
 * equality sides, explicit versus implicit multiplication and whitespace. */
export function pairingEquationKey(raw: string): string {
  const normalized = raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/gu, "")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/([0-9س)])(?=س|\()/g, "$1*")
    .replace(/\)(?=[0-9])/g, ")*");
  return normalized.split("=").sort().join("=");
}
export function selectStudioPairing(
  root: ContentPayload,
  sources: StudioPairingSource[],
): { remediation: StudioPairingSource; transfer: StudioPairingSource } | null {
  if (root.subject !== "algebra" || root.kind !== "main" || !root.algebra)
    return null;
  const eligible = sources.filter((s) => {
    const p = s.payload;
    return (
      p.subject === "algebra" &&
      !!p.algebra &&
      p.unitCode === root.unitCode &&
      p.lessonCode === root.lessonCode &&
      p.skillCodes[0] === root.skillCodes[0] &&
      s.validation?.valid === true &&
      s.validation.engine === "math-internal-v1" &&
      !!s.reviewed_by &&
      !!s.reviewed_at &&
      !!s.published_at &&
      p.hints.every((h) => h.reviewed) &&
      [1, 2, 3].every((level) => p.hints.some((h) => h.level === level)) &&
      studioHintIssues(p).length === 0 &&
      pairingEquationKey(p.algebra.equationRaw) !==
        pairingEquationKey(root.algebra!.equationRaw)
    );
  });
  const remedies = eligible
    .filter(
      (s) =>
        s.payload.kind === "remediation" &&
        s.payload.familyCode !== root.familyCode &&
        s.payload.difficulty <= root.difficulty &&
        root.difficulty - s.payload.difficulty <= 1,
    )
    .sort(
      (a, b) =>
        Math.abs(a.payload.difficulty - root.difficulty) -
          Math.abs(b.payload.difficulty - root.difficulty) ||
        a.id.localeCompare(b.id),
    );
  for (const remediation of remedies) {
    const transfers = eligible
      .filter(
        (s) =>
          s.payload.kind === "transfer" &&
          s.id !== remediation.id &&
          s.item_id !== remediation.item_id &&
          s.payload.familyCode !== root.familyCode &&
          s.payload.familyCode !== remediation.payload.familyCode &&
          Math.abs(s.payload.difficulty - remediation.payload.difficulty) <=
            1 &&
          pairingEquationKey(s.payload.algebra!.equationRaw) !==
            pairingEquationKey(remediation.payload.algebra!.equationRaw),
      )
      .sort(
        (a, b) =>
          Math.abs(a.payload.difficulty - remediation.payload.difficulty) -
            Math.abs(b.payload.difficulty - remediation.payload.difficulty) ||
          a.id.localeCompare(b.id),
      );
    if (transfers[0]) return { remediation, transfer: transfers[0] };
  }
  return null;
}
export async function materializeStudioPairings(
  tx: Prisma.TransactionClient,
  input: {
    root: ContentPayload;
    rootRevisionId: string;
    releaseId: string;
    skillId: string;
    reviewerId: string;
  },
): Promise<{
  pairingId: string | null;
  remediationRevisionId: string | null;
  transferRevisionId: string | null;
}> {
  const { root, rootRevisionId, releaseId, skillId, reviewerId } = input;
  if (root.subject !== "algebra" || root.kind !== "main")
    return {
      pairingId: null,
      remediationRevisionId: null,
      transferRevisionId: null,
    };
  const [scope] = await tx.$queryRaw<
    { id: string; learning_family: string | null; status: string }[]
  >`SELECT p.id,p.learning_family,c.status FROM problem_revisions p JOIN content_releases c ON c.id=p.release_id JOIN problem_skills ps ON ps.problem_revision_id=p.id WHERE p.id=${rootRevisionId}::uuid AND p.release_id=${releaseId}::uuid AND ps.skill_id=${skillId}::uuid AND ps.coverage_kind='primary' FOR SHARE OF p,c`;
  if (
    !scope ||
    scope.status !== "draft" ||
    scope.learning_family !== root.familyCode
  )
    throw new ApiFault(
      409,
      "invalid_state",
      "يجب تكوين حزمة العلاج والنقل داخل إصدار جديد قبل نشره، مع تثبيت عائلة المسألة الأصلية.",
    );
  const rows = await tx.$queryRaw<
    StudioPairingSource[]
  >`SELECT id,item_id,payload,content_hash,validation,reviewed_by,reviewed_at,published_at FROM studio_revisions WHERE status='published' AND payload->>'subject'='algebra' AND payload->>'unitCode'=${root.unitCode} AND payload->>'lessonCode'=${root.lessonCode} AND payload->'skillCodes'->>0=${root.skillCodes[0]} AND payload->>'kind' IN ('remediation','transfer') AND validation->>'valid'='true' ORDER BY id LIMIT 100 FOR SHARE`;
  const pair = selectStudioPairing(
    root,
    rows.map((r) => ({ ...r, payload: parsePayload(r.payload) })),
  );
  if (!pair)
    throw new ApiFault(
      422,
      "invalid_input",
      "انشر أولًا تمرينًا علاجيًا وسؤال نقل مراجعين للدرس والمهارة نفسيهما، بعائلة نقل ومعادلة مختلفتين وصعوبة مقاربة، ثم انشر المسألة الرئيسية.",
    );
  const clone = async (source: StudioPairingSource): Promise<string> => {
    const p = source.payload,
      a = p.algebra!,
      problemId = randomUUID(),
      revisionId = randomUUID();
    await tx.$executeRaw`INSERT INTO problems(id,problem_code) VALUES(${problemId}::uuid,${"STUDIO-PAIR-" + problemId})`;
    await tx.$executeRaw`INSERT INTO problem_revisions(id,problem_id,version_number,release_id,item_kind,statement_ar,original_equation_raw,answer_spec,difficulty_band,notation_profile,review_status,reviewed_at,published_at,content_hash,learning_family) VALUES(${revisionId}::uuid,${problemId}::uuid,1,${releaseId}::uuid,${p.kind},${p.statementAr},${a.equationRaw},${JSON.stringify({ kind: "linear_one_variable", finalRaw: a.answerRaw })}::jsonb,${p.difficulty},'ar-mashriq-school-v1','published',${source.reviewed_at},now(),${source.content_hash},${p.familyCode})`;
    await tx.$executeRaw`INSERT INTO problem_skills(problem_revision_id,skill_id,coverage_kind) VALUES(${revisionId}::uuid,${skillId}::uuid,'primary')`;
    await materializeStudioHints(tx, {
      payload: p,
      releaseId,
      problemRevisionId: revisionId,
      studioRevisionId: source.id,
      reviewerId: source.reviewed_by!,
    });
    return revisionId;
  };
  const remediationRevisionId = await clone(pair.remediation),
    transferRevisionId = await clone(pair.transfer),
    pairingId = randomUUID();
  const checks = {
    status: "verified_valid",
    basis: "snapshot_of_validated_published_content",
    rootRevisionId,
    sources: [pair.remediation, pair.transfer].map((s) => ({
      studioRevisionId: s.id,
      itemId: s.item_id,
      contentHash: s.content_hash,
      validation: s.validation,
      reviewedBy: s.reviewed_by,
      reviewedAt: s.reviewed_at!.toISOString(),
      payload: s.payload,
    })),
  };
  const contrast =
    "معادلة وقيم مختلفة عن التدريب والمسألة الأصلية ضمن المهارة نفسها؛ تُحجب التلميحات أثناء قياس النقل المستقل.";
  await tx.$executeRaw`INSERT INTO content_pairings(id,release_id,skill_id,root_problem_revision_id,remediation_revision_id,transfer_revision_id,version,transfer_contrast,math_checks,review_status,reviewed_by_role,reviewed_at,enabled,is_synthetic) VALUES(${pairingId}::uuid,${releaseId}::uuid,${skillId}::uuid,${rootRevisionId}::uuid,${remediationRevisionId}::uuid,${transferRevisionId}::uuid,'studio-pairing-v1.1',${contrast},${JSON.stringify(checks)}::jsonb,'reviewed',${"admin:" + reviewerId},now(),true,true)`;
  return { pairingId, remediationRevisionId, transferRevisionId };
}
