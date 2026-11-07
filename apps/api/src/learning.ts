import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiFault } from "./http";
import { output, type Schema } from "./contracts";
import type { Store, GuestAuth, AttemptRow } from "./store";
import { projectDiagnosis } from "./diagnosis";
import {
  realLearningConfigured,
  requireLearningAccess,
} from "./learning-access";
import { DIAGNOSIS_POLICY } from "./diagnosis-rules";
import { hasAssistance } from "./assistance";
import {
  LEARNING_POLICY,
  evidenceState,
  learningObservation,
  type Observation,
} from "./learning-policy";
type Tx = Prisma.TransactionClient;
type Episode = {
  id: string;
  root_attempt_id: string;
  root_revision: bigint;
  skill_id: string;
  release_id: string;
  state: Schema<"LearningEpisodeState">;
  created_at: Date;
  ended_at: Date | null;
  policy_version: string;
  is_synthetic: boolean;
};
type Assignment = {
  id: string;
  episode_id: string;
  pairing_id: string;
  phase: "remediation" | "transfer";
  problem_revision_id: string;
  attempt_id: string | null;
  assignment_order: number;
  assistance_policy: "guided" | "limited" | "independent";
  measurement_exited_at: Date | null;
  invalidated_at: Date | null;
  assigned_at: Date;
  completed_at: Date | null;
};
type Pair = {
  id: string;
  remediation_revision_id: string;
  transfer_revision_id: string;
  skill_id: string;
};
const missing = () => new ApiFault(404, "not_found", "المورد غير متاح.");
const blocked = (
  message = "لا يمكن متابعة الحلقة بهذه الحالة. أكمل التحقق الحالي أولًا.",
) => new ApiFault(409, "invalid_state", message);
const unavailable = () =>
  new ApiFault(
    503,
    "internal_error",
    "لا يتوفر نشاط صالح جديد لهذه المهارة الآن. يمكنك مراجعة خطواتك أو التوقف؛ لن نكرر مسألة مكشوفة كقياس مستقل.",
  );
export const ph08Active = () => process.env.PH08_API_ENABLED === "true";
export async function recordExposure(
  tx: Tx,
  guestId: string,
  problemId: string,
  kind: string,
) {
  const [p] = await tx.$queryRaw<
    { learning_family: string | null; original_equation_raw: string }[]
  >`SELECT learning_family,original_equation_raw FROM problem_revisions WHERE id=${problemId}::uuid`;
  if (!p) throw missing();
  const hash = createHash("sha256")
    .update(p.original_equation_raw.replace(/\s+/gu, ""))
    .digest("hex");
  await tx.$executeRaw`INSERT INTO content_exposures(id,guest_session_id,problem_revision_id,learning_family,equation_hash,exposure_kind) VALUES(${randomUUID()}::uuid,${guestId}::uuid,${problemId}::uuid,${p.learning_family ?? "unclassified:" + problemId},${hash},${kind}) ON CONFLICT(guest_session_id,problem_revision_id) DO NOTHING`;
}
export async function requireAssignmentCurrent(tx: Tx, attemptId: string) {
  const [x] = await tx.$queryRaw<
    {
      invalidated_at: Date | null;
      state: string;
      enabled: boolean;
      current: boolean;
    }[]
  >`SELECT x.invalidated_at,e.state,p.enabled,(root.revision=e.root_revision) AS current FROM learning_assignments x JOIN learning_episodes e ON e.id=x.episode_id JOIN attempts root ON root.id=e.root_attempt_id JOIN content_pairings p ON p.id=x.pairing_id WHERE x.attempt_id=${attemptId}::uuid`;
  if (
    x &&
    (x.invalidated_at || x.state === "cancelled" || !x.current || !x.enabled)
  )
    throw blocked(
      "تغير أصل الحلقة أو محتواها؛ لا يُستعمل إسناد قديم. ابدأ تدريبًا من النسخة الحالية.",
    );
}
/** A transfer request itself is explicit consent to leave measurement. Public HintInput remains unchanged. */
export async function transferLearningKind(
  tx: Tx,
  a: AttemptRow,
  input: Schema<"HintInput">,
): Promise<Schema<"AttemptKind">> {
  if (!ph08Active() || a.attempt_kind !== "transfer") return a.attempt_kind;
  await requireAssignmentCurrent(tx, a.id);
  const [x] = await tx.$queryRaw<
    Assignment[]
  >`SELECT * FROM learning_assignments WHERE attempt_id=${a.id}::uuid FOR UPDATE`;
  if (
    !x ||
    (input.action === "show_full_solution" &&
      input.confirmAssistedCompletion !== true)
  )
    return a.attempt_kind;
  if (x.assistance_policy === "independent") {
    await tx.$executeRaw`UPDATE learning_assignments SET assistance_policy='guided',measurement_exited_at=now() WHERE id=${x.id}::uuid`;
    await tx.$executeRaw`UPDATE attempts SET independent_evidence_eligible=false,assistance_revision=assistance_revision+1,status=CASE WHEN status='completed' THEN 'assisted_completed' ELSE status END WHERE id=${a.id}::uuid`;
    a.independent_evidence_eligible = false;
    a.assistance_revision = (a.assistance_revision ?? 0) + 1;
    await tx.$executeRaw`INSERT INTO audit_events(id,correlation_id,entity_kind,entity_id,event_code,limited_metadata) VALUES(${randomUUID()}::uuid,${randomUUID()}::uuid,'attempt',${a.id}::uuid,'transfer_measurement_exited',${JSON.stringify({ policyVersion: LEARNING_POLICY, action: input.action })}::jsonb)`;
  }
  return "remediation";
}
export async function recordLearningEvidence(
  tx: Tx,
  a: AttemptRow,
  report: Schema<"VerificationReport">,
) {
  if (!ph08Active() || report.scope !== "current_sequence" || !report.isCurrent)
    return;
  await requireAssignmentCurrent(tx, a.id);
  const [x] = await tx.$queryRaw<
    (Assignment & { skill_id: string; release_id: string })[]
  >`SELECT x.*,e.skill_id,e.release_id FROM learning_assignments x JOIN learning_episodes e ON e.id=x.episode_id WHERE x.attempt_id=${a.id}::uuid AND x.invalidated_at IS NULL`;
  if (!x) return;
  const [fresh] =
    x.phase === "transfer" && !hasAssistance(a)
      ? await tx.$queryRaw<
          { fresh: boolean }[]
        >`SELECT transfer_content_unexposed(${a.id}::uuid) AS fresh`
      : [{ fresh: true }];
  const exposed = !fresh?.fresh;
  const independent =
    !exposed &&
    x.phase === "transfer" &&
    x.assistance_policy === "independent" &&
    !hasAssistance(a) &&
    !x.measurement_exited_at;
  const observation = exposed
    ? "non_assessable"
    : learningObservation(report, independent);
  const snapshot = {
    highestHintLevelSeen: `H${a.highest_hint_level_seen ?? 0}`,
    fullSolutionSeen: a.full_solution_seen ?? false,
    priorSameProblemExposure: exposed,
    phase: x.phase,
    assessmentMode: independent ? "transfer_check" : "learning",
    independentEvidenceEligible: independent,
    policyVersion: LEARNING_POLICY,
  };
  await tx.$executeRaw`INSERT INTO skill_evidence(id,learning_session_id,skill_id,attempt_id,attempt_revision,problem_revision_id,report_id,assignment_id,event_kind,observation,assistance_snapshot,assistance_revision,policy_version,content_release_id,dedup_key)
    VALUES(${randomUUID()}::uuid,${a.learning_session_id}::uuid,${x.skill_id}::uuid,${a.id}::uuid,${a.revision},${a.problem_revision_id}::uuid,${report.id}::uuid,${x.id}::uuid,${x.phase === "transfer" ? "transfer_observation" : "guided_practice"},${observation},${JSON.stringify(snapshot)}::jsonb,${a.assistance_revision ?? 0},${LEARNING_POLICY},${x.release_id}::uuid,${report.id + ":" + x.id + ":" + (a.assistance_revision ?? 0)}) ON CONFLICT DO NOTHING`;
  await tx.$executeRaw`UPDATE learning_assignments SET completed_at=${report.completion.canMarkAttemptCompleted ? new Date() : null} WHERE id=${x.id}::uuid`;
  await tx.$executeRaw`UPDATE learning_episodes SET state=${x.phase === "remediation" ? (report.completion.canMarkAttemptCompleted ? "awaiting_transfer" : "remediating") : report.completion.canMarkAttemptCompleted ? "finished" : "awaiting_transfer"},ended_at=${x.phase === "transfer" && report.completion.canMarkAttemptCompleted ? new Date() : null} WHERE id=${x.episode_id}::uuid AND state<>'cancelled'`;
}
export class LearningService {
  constructor(
    readonly store: Store,
    readonly active = false,
    readonly maxRemediation = 2,
    readonly maxTransfer = 2,
  ) {
    if (active && !store.syntheticData && !realLearningConfigured())
      throw Error(
        "Learning requires synthetic data or explicitly configured real learning",
      );
    if (
      ![maxRemediation, maxTransfer].every(
        (n) => Number.isSafeInteger(n) && n > 0 && n <= 10,
      )
    )
      throw Error("Explicit bounded PH-08 assignment limits required");
  }
  private enabled() {
    if (!this.active || !ph08Active()) throw missing();
  }
  private async attempt(
    tx: Tx,
    auth: GuestAuth,
    id: string,
    revision?: number,
  ) {
    const a = await this.store.readAttemptInTransaction(tx, auth, id);
    if (revision !== undefined && a.revision !== BigInt(revision))
      throw new ApiFault(
        409,
        "revision_conflict",
        "تغيّرت المحاولة. حدّثها أولًا.",
        [],
        Number(a.revision),
      );
    const [l] = await tx.$queryRaw<
      { is_synthetic: boolean; status: string }[]
    >`SELECT is_synthetic,status FROM learning_sessions WHERE id=${a.learning_session_id}::uuid`;
    if (!l || l.status !== "active" || a.status === "stopped") throw blocked();
    await requireLearningAccess(tx, auth, l.is_synthetic);
    return { ...a, learning_is_synthetic: l.is_synthetic };
  }
  private async episode(tx: Tx, auth: GuestAuth, id: string): Promise<Episode> {
    const [e] = await tx.$queryRaw<
      (Episode & { learning_is_synthetic: boolean })[]
    >`SELECT e.*,l.is_synthetic AS learning_is_synthetic FROM learning_episodes e JOIN attempts a ON a.id=e.root_attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id WHERE e.id=${id}::uuid AND l.guest_session_id=${auth.row.id}::uuid FOR UPDATE OF e`;
    if (!e) throw missing();
    await requireLearningAccess(tx, auth, e.learning_is_synthetic);
    if (e.is_synthetic !== e.learning_is_synthetic) throw blocked();
    return e;
  }
  private async report(tx: Tx, auth: GuestAuth, a: AttemptRow) {
    const [r] = await tx.$queryRaw<
      { report_json: unknown }[]
    >`SELECT report_json FROM verification_reports WHERE attempt_id=${a.id}::uuid AND attempt_revision=${a.revision} AND problem_revision_id=${a.problem_revision_id}::uuid AND scope='current_sequence' AND dispatch_status='finished' AND report_json->>'isCurrent'='true' ORDER BY finished_at DESC,id DESC LIMIT 1`;
    if (!r) throw blocked();
    const result = await projectDiagnosis(
      tx,
      output("VerificationReport", r.report_json),
      auth,
    );
    if (
      !result.transitions.length ||
      result.transitions.some(
        (t) => !["verified_valid", "verified_invalid"].includes(t.mathStatus),
      )
    )
      throw blocked(
        "أصلح الصيغة أو أعد التحقق؛ تعذر التقييم لا يبدأ علاجًا أو قياسًا معرفيًا.",
      );
    return result;
  }
  private async pairs(
    tx: Tx,
    e: { root_attempt_id: string; skill_id: string; release_id: string },
  ): Promise<Pair[]> {
    return tx.$queryRaw<
      Pair[]
    >`SELECT p.id,p.remediation_revision_id,p.transfer_revision_id,p.skill_id FROM content_pairings p JOIN attempts a ON a.id=${e.root_attempt_id}::uuid JOIN problem_revisions root ON root.id=a.problem_revision_id JOIN problem_revisions rem ON rem.id=p.remediation_revision_id JOIN problem_revisions tr ON tr.id=p.transfer_revision_id JOIN content_releases c ON c.id=p.release_id JOIN problems rb ON rb.id=rem.problem_id JOIN problems tb ON tb.id=tr.problem_id JOIN skills s ON s.id=p.skill_id WHERE p.root_problem_revision_id=a.problem_revision_id AND p.skill_id=${e.skill_id}::uuid AND p.release_id=${e.release_id}::uuid AND p.enabled AND p.is_synthetic AND rem.review_status='published' AND tr.review_status='published' AND rem.item_kind='remediation' AND tr.item_kind='transfer' AND rem.problem_id<>tr.problem_id AND rem.id<>tr.id AND regexp_replace(rem.original_equation_raw,'[[:space:]]','','g')<>regexp_replace(tr.original_equation_raw,'[[:space:]]','','g') AND abs(rem.difficulty_band-root.difficulty_band)<=1 AND abs(tr.difficulty_band-rem.difficulty_band)<=1 AND c.status='published' AND s.status='active' AND rb.archived_at IS NULL AND tb.archived_at IS NULL AND p.math_checks->>'status'='verified_valid' ORDER BY CASE WHEN a.highest_hint_level_seen>=2 THEN rem.difficulty_band ELSE abs(rem.difficulty_band-root.difficulty_band) END,p.version,p.id FOR SHARE OF p,rem,tr,c,s`;
  }
  private async fresh(tx: Tx, guestId: string, id: string) {
    const [p] = await tx.$queryRaw<
      { learning_family: string | null; original_equation_raw: string }[]
    >`SELECT learning_family,original_equation_raw FROM problem_revisions WHERE id=${id}::uuid`;
    if (!p?.learning_family) return false;
    const hash = createHash("sha256")
      .update(p.original_equation_raw.replace(/\s+/gu, ""))
      .digest("hex");
    const [seen] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM content_exposures WHERE guest_session_id=${guestId}::uuid AND (problem_revision_id=${id}::uuid OR learning_family=${p.learning_family} OR equation_hash=${hash}) LIMIT 1`;
    if (seen) return false;
    const [history] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT a.id FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_revisions r ON r.id=a.problem_revision_id WHERE l.guest_session_id=${guestId}::uuid AND (r.problem_id=(SELECT problem_id FROM problem_revisions WHERE id=${id}::uuid) OR r.learning_family=${p.learning_family} OR regexp_replace(r.original_equation_raw,'\\s','','g')=regexp_replace(${p.original_equation_raw},'\\s','','g')) LIMIT 1`;
    if (history) return false;
    const [leaked] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT t.id FROM tutoring_events t JOIN attempts a ON a.id=t.attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id WHERE l.guest_session_id=${guestId}::uuid AND strpos(regexp_replace(t.public_json::text,'[[:space:]]','','g'),regexp_replace(${p.original_equation_raw},'[[:space:]]','','g'))>0 LIMIT 1`;
    if (leaked) return false;
    const [probe] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT p.id FROM diagnostic_probes p JOIN diagnoses d ON d.id=p.diagnosis_id JOIN attempts a ON a.id=d.attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id WHERE l.guest_session_id=${guestId}::uuid AND strpos(regexp_replace(p.public_json::text,'[[:space:]]','','g'),regexp_replace(${p.original_equation_raw},'[[:space:]]','','g'))>0 LIMIT 1`;
    return !probe;
  }
  private async assign(
    tx: Tx,
    auth: GuestAuth,
    e: Episode,
    phase: "remediation" | "transfer",
    pair: Pair,
    count: number,
  ) {
    const id = randomUUID(),
      revision =
        phase === "remediation"
          ? pair.remediation_revision_id
          : pair.transfer_revision_id;
    await tx.$executeRaw`INSERT INTO learning_assignments(id,episode_id,pairing_id,phase,problem_revision_id,assignment_order,assistance_policy) VALUES(${id}::uuid,${e.id}::uuid,${pair.id}::uuid,${phase},${revision}::uuid,${count + 1},${phase === "transfer" ? "independent" : "guided"})`;
    if (phase === "remediation" && count > 0)
      await tx.$executeRaw`UPDATE learning_assignments SET invalidated_at=COALESCE(invalidated_at,now()) WHERE episode_id=${e.id}::uuid AND phase='transfer'`;
    await recordExposure(tx, auth.row.id, revision, "assignment_" + phase);
    await tx.$executeRaw`UPDATE learning_episodes SET state=${phase === "transfer" ? "awaiting_transfer" : "remediating"},ended_at=NULL WHERE id=${e.id}::uuid`;
  }
  async startRemediation(
    auth: GuestAuth,
    id: string,
    key: string,
    body: Schema<"StartRemediationInput">,
  ) {
    this.enabled();
    return this.store.mutate(
      auth,
      "learning.remediation",
      key,
      { id, body },
      async (tx) => {
        const a = await this.attempt(tx, auth, id, body.expectedRevision);
        await requireAssignmentCurrent(tx, a.id);
        const rootReport = await this.report(tx, auth, a);
        const [openProbe] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT p.id FROM diagnostic_probes p JOIN current_diagnoses d ON d.id=p.diagnosis_id WHERE d.attempt_id=${a.id}::uuid AND d.diagnosis_policy_version=${DIAGNOSIS_POLICY} AND NOT EXISTS(SELECT 1 FROM probe_responses r WHERE r.probe_id=p.id)`;
        if (openProbe)
          throw blocked(
            "أجب عن السؤال التأكيدي المفتوح قبل بدء نشاط قد يلقّن إجابته.",
          );
        const [linked] = await tx.$queryRaw<
          { episode_id: string }[]
        >`SELECT episode_id FROM learning_assignments WHERE attempt_id=${a.id}::uuid`;
        let e: Episode | undefined;
        if (linked) e = await this.episode(tx, auth, linked.episode_id);
        else {
          if (a.attempt_kind !== "main") throw blocked();
          e = (
            await tx.$queryRaw<
              Episode[]
            >`SELECT * FROM learning_episodes WHERE root_attempt_id=${a.id}::uuid AND root_revision=${a.revision} AND state<>'cancelled' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`
          )[0];
        }
        let status = 200;
        if (!e) {
          const targetSkill =
            rootReport.diagnosisCandidate &&
            !["unresolved", "rejected"].includes(
              rootReport.diagnosisCandidate.state,
            )
              ? rootReport.diagnosisCandidate.skillId
              : null;
          const [p] = await tx.$queryRaw<
            { skill_id: string; release_id: string }[]
          >`SELECT ps.skill_id,p.release_id FROM problem_revisions p JOIN problem_skills ps ON ps.problem_revision_id=p.id WHERE p.id=${a.problem_revision_id}::uuid AND ((${targetSkill}::uuid IS NOT NULL AND ps.skill_id=${targetSkill}::uuid) OR (${targetSkill}::uuid IS NULL AND ps.coverage_kind='primary'))`;
          if (!p) throw unavailable();
          e = {
            id: randomUUID(),
            root_attempt_id: a.id,
            root_revision: a.revision,
            skill_id: p.skill_id,
            release_id: p.release_id,
            state: "remediating",
            created_at: new Date(),
            ended_at: null,
            policy_version: LEARNING_POLICY,
            is_synthetic: a.learning_is_synthetic,
          };
          await tx.$executeRaw`INSERT INTO learning_episodes(id,root_attempt_id,root_revision,skill_id,release_id,policy_version,state,is_synthetic) VALUES(${e.id}::uuid,${a.id}::uuid,${a.revision},${e.skill_id}::uuid,${e.release_id}::uuid,${LEARNING_POLICY},'remediating',${e.is_synthetic})`;
          status = 201;
        }
        const assignments = await tx.$queryRaw<
          Assignment[]
        >`SELECT * FROM learning_assignments WHERE episode_id=${e.id}::uuid ORDER BY assigned_at,id`;
        if (assignments.length) {
          const last = assignments.at(-1)!;
          // Repeated root requests return the existing loop; only the current failed child may request a new activity.
          if (!linked || last.attempt_id !== a.id || last.invalidated_at)
            return { status: 200, data: await this.dto(tx, e) };
          const report = await this.report(tx, auth, a);
          if (learningObservation(report, false) !== "needs_review")
            return { status: 200, data: await this.dto(tx, e) };
        }
        const count = assignments.filter(
          (x) => x.phase === "remediation",
        ).length;
        if (count >= this.maxRemediation)
          throw blocked(
            "بلغت حد التدريب لهذه الحلقة. يمكنك طلب شرح للمسألة الحالية أو التوقف؛ لا يبدأ تدريب متكرر تلقائيًا.",
          );
        const pair = await this.pairs(tx, e);
        let chosen: Pair | undefined;
        for (const p of pair)
          if (await this.fresh(tx, auth.row.id, p.remediation_revision_id)) {
            chosen = p;
            break;
          }
        if (!chosen) throw unavailable();
        await this.assign(tx, auth, e, "remediation", chosen, count);
        return { status, data: await this.dto(tx, e) };
      },
      false,
      async (tx, cached) => {
        await this.attempt(tx, auth, id, body.expectedRevision);
        return this.dto(tx, await this.episode(tx, auth, cached.id));
      },
    );
  }
  async startTransfer(
    auth: GuestAuth,
    id: string,
    key: string,
    body: Schema<"StartTransferInput">,
  ) {
    this.enabled();
    return this.store.mutate(
      auth,
      "learning.transfer",
      key,
      { id, body },
      async (tx) => {
        const a = await this.attempt(tx, auth, id, body.expectedRevision),
          e = await this.episode(tx, auth, body.episodeId);
        if (
          e.root_attempt_id !== a.id ||
          e.root_revision !== a.revision ||
          e.state === "cancelled"
        )
          throw blocked();
        const xs = await tx.$queryRaw<
          Assignment[]
        >`SELECT * FROM learning_assignments WHERE episode_id=${e.id}::uuid ORDER BY assigned_at,id`;
        const last = xs.at(-1);
        if (!last || last.invalidated_at) throw blocked();
        if (last.phase === "transfer" && !last.attempt_id)
          return { status: 201, data: await this.dto(tx, e) };
        if (!last.attempt_id) throw blocked();
        const child = await this.attempt(tx, auth, last.attempt_id),
          r = await this.report(tx, auth, child);
        if (last.phase === "transfer" && !r.completion.canMarkAttemptCompleted)
          return { status: 201, data: await this.dto(tx, e) };
        if (!r.completion.canMarkAttemptCompleted)
          throw blocked("أكمل التدريب العلاجي بتحقق صالح قبل مسألة النقل.");
        const [unexposed] =
          last.phase === "transfer"
            ? await tx.$queryRaw<
                { fresh: boolean }[]
              >`SELECT transfer_content_unexposed(${child.id}::uuid) AS fresh`
            : [{ fresh: true }];
        if (
          last.phase === "transfer" &&
          unexposed?.fresh &&
          !hasAssistance(child) &&
          last.assistance_policy === "independent"
        )
          return { status: 201, data: await this.dto(tx, e) };
        const count = xs.filter((x) => x.phase === "transfer").length;
        if (count >= this.maxTransfer)
          throw blocked(
            "بلغت حد مسائل النقل لهذه الحلقة. احتفظنا بالدليل والمساعدة؛ يمكنك التوقف ومراجعة ما تعلمته.",
          );
        const rem = [...xs]
          .reverse()
          .find((x) => x.phase === "remediation" && !x.invalidated_at);
        if (!rem) throw blocked();
        let chosen: Pair | undefined;
        for (const p of await this.pairs(tx, e))
          if (
            p.remediation_revision_id === rem.problem_revision_id &&
            (await this.fresh(tx, auth.row.id, p.transfer_revision_id))
          ) {
            chosen = p;
            break;
          }
        if (!chosen) throw unavailable();
        await this.assign(tx, auth, e, "transfer", chosen, count);
        return { status: 201, data: await this.dto(tx, e) };
      },
      false,
      async (tx, cached) => {
        await this.attempt(tx, auth, id, body.expectedRevision);
        return this.dto(tx, await this.episode(tx, auth, cached.id));
      },
    );
  }
  private async dto(tx: Tx, e: Episode): Promise<Schema<"LearningEpisode">> {
    const [root] = await tx.$queryRaw<
      { revision: bigint }[]
    >`SELECT revision FROM attempts WHERE id=${e.root_attempt_id}::uuid`;
    const cancelled =
      e.state === "cancelled" || root?.revision !== e.root_revision;
    const xs = cancelled
      ? []
      : await tx.$queryRaw<
          Assignment[]
        >`SELECT x.* FROM learning_assignments x JOIN content_pairings p ON p.id=x.pairing_id WHERE x.episode_id=${e.id}::uuid AND x.invalidated_at IS NULL AND p.enabled ORDER BY x.assigned_at,x.id`;
    const assignments = [];
    for (const x of xs) {
      const [p] = await tx.$queryRaw<
        {
          id: string;
          problem_id: string;
          version_number: number;
          statement_ar: string;
          original_equation_raw: string;
          item_kind: "remediation" | "transfer";
          notation_profile: "ar-mashriq-school-v1";
          difficulty_band: number;
          release_id: string;
        }[]
      >`SELECT * FROM problem_revisions WHERE id=${x.problem_revision_id}::uuid AND review_status='published'`;
      if (!p) continue;
      assignments.push({
        id: x.id,
        episodeId: e.id,
        phase: x.phase,
        problemRevisionId: x.problem_revision_id,
        problem: {
          id: p.problem_id,
          revisionId: p.id,
          versionNumber: p.version_number,
          statementAr: p.statement_ar,
          originalEquation: p.original_equation_raw,
          kind: p.item_kind,
          primarySkillId: e.skill_id,
          notationProfile: p.notation_profile,
          difficultyBand: p.difficulty_band,
          contentReleaseId: p.release_id,
        },
        assistancePolicy: x.assistance_policy,
        attemptId: x.attempt_id,
        assignedAt: x.assigned_at.toISOString(),
      });
    }
    const last = xs.at(-1);
    let state = e.state,
      next: Schema<"LearningEpisode">["nextAction"] = "none";
    if (cancelled) state = "cancelled";
    else if (last) {
      const [a] = last.attempt_id
        ? await tx.$queryRaw<
            AttemptRow[]
          >`SELECT * FROM attempts WHERE id=${last.attempt_id}::uuid`
        : [];
      const completed =
        a && ["completed", "assisted_completed"].includes(a.status);
      if (last.phase === "remediation") {
        state = completed ? "awaiting_transfer" : "remediating";
        next = completed ? "start_transfer" : "complete_remediation";
      } else {
        state = completed ? "finished" : "awaiting_transfer";
        const [fresh] = a
          ? await tx.$queryRaw<
              { fresh: boolean }[]
            >`SELECT transfer_content_unexposed(${a.id}::uuid) AS fresh`
          : [{ fresh: true }];
        next = completed
          ? last.measurement_exited_at ||
            !fresh?.fresh ||
            (a && hasAssistance(a))
            ? "start_transfer"
            : "review_progress"
          : "none";
      }
    }
    return output("LearningEpisode", {
      id: e.id,
      rootAttemptId: e.root_attempt_id,
      skillId: e.skill_id,
      state,
      assignments,
      createdAt: e.created_at.toISOString(),
      endedAt:
        state === "finished"
          ? (e.ended_at?.toISOString() ?? null)
          : state === "cancelled"
            ? (e.ended_at?.toISOString() ?? null)
            : null,
      nextAction: next,
    });
  }
  async get(auth: GuestAuth, id: string) {
    this.enabled();
    return this.store.db.$transaction(async (tx) => {
      await this.store.authorizeInTransaction(tx, auth);
      return this.dto(tx, await this.episode(tx, auth, id));
    });
  }
  async progress(
    auth: GuestAuth,
    learningId: string,
    skillId?: string,
  ): Promise<Schema<"ProgressSummary">> {
    this.enabled();
    return this.store.db.$transaction(async (tx) => {
      await this.store.authorizeInTransaction(tx, auth);
      const [l] = await tx.$queryRaw<
        { is_synthetic: boolean; release_id: string }[]
      >`SELECT is_synthetic,release_id FROM learning_sessions WHERE id=${learningId}::uuid AND guest_session_id=${auth.row.id}::uuid`;
      if (!l) throw missing();
      await requireLearningAccess(tx, auth, l.is_synthetic);
      const skills = await tx.$queryRaw<
        { id: string; skill_code: string; name_ar: string }[]
      >`SELECT id,skill_code,name_ar FROM skills WHERE release_id=${l.release_id}::uuid AND status='active' AND (${skillId ?? null}::uuid IS NULL OR id=${skillId ?? null}::uuid) ORDER BY sort_order,id`;
      if (skillId && !skills.length) throw missing();
      const evidence = await tx.$queryRaw<
        {
          skill_id: string;
          event_kind: string;
          observation: Observation;
          created_at: Date;
        }[]
      >`SELECT v.skill_id,v.event_kind,v.observation,v.created_at FROM skill_evidence v JOIN attempts a ON a.id=v.attempt_id JOIN learning_assignments x ON x.id=v.assignment_id JOIN learning_episodes e ON e.id=x.episode_id JOIN attempts root ON root.id=e.root_attempt_id JOIN content_pairings p ON p.id=x.pairing_id JOIN problem_revisions r ON r.id=a.problem_revision_id JOIN content_releases c ON c.id=e.release_id WHERE v.learning_session_id=${learningId}::uuid AND v.attempt_revision=a.revision AND v.assistance_revision=a.assistance_revision AND root.revision=e.root_revision AND e.state<>'cancelled' AND x.invalidated_at IS NULL AND p.enabled AND r.review_status='published' AND c.status='published' AND v.policy_version=${LEARNING_POLICY} AND (v.event_kind<>'transfer_observation' OR v.observation<>'positive' OR transfer_content_unexposed(a.id)) AND v.report_id=(SELECT id FROM verification_reports WHERE attempt_id=a.id AND attempt_revision=a.revision AND scope='current_sequence' AND dispatch_status='finished' AND report_json->>'isCurrent'='true' ORDER BY finished_at DESC,id DESC LIMIT 1) ORDER BY v.created_at DESC,v.id DESC`;
      return {
        learningSessionId: learningId,
        isSynthetic: l.is_synthetic,
        skills: skills.map((s) => {
          const es = evidence.filter((e) => e.skill_id === s.id);
          return {
            skillId: s.id,
            skillCode: s.skill_code,
            titleAr: s.name_ar,
            state: evidenceState(es),
            evidenceCount: es.filter((e) => e.observation !== "non_assessable")
              .length,
            independentTransferCount: es.filter(
              (e) =>
                e.event_kind === "transfer_observation" &&
                e.observation === "positive",
            ).length,
            assistedPracticeCount: es.filter(
              (e) => e.observation === "assisted",
            ).length,
            updatedAt: es[0]?.created_at.toISOString() ?? null,
          };
        }),
        updatedAt: new Date().toISOString(),
        noteAr:
          (l.is_synthetic
            ? "بيانات اختبار اصطناعية. "
            : "أدلة خاصة بحسابك وموافقتك الحالية. ") +
          "الدليل يخص المحاولات الحالية وظروف المساعدة؛ عدم التقييم لا يعني صفرًا، ونجاح مسألة واحدة لا يثبت إتقانًا دائمًا.",
      };
    });
  }
}
