import { randomUUID, randomInt, createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { output, Schema } from "./contracts";
import { ApiFault } from "./http";
import { requireUnassistedProbe } from "./assistance";
import type { AttemptRow, GuestAuth, Store } from "./store";
import {
  DIAGNOSIS_POLICY,
  ErrorCode,
  observeTransition,
} from "./diagnosis-rules";
type Tx = Prisma.TransactionClient;
type Candidate = Schema<"DiagnosisCandidate">;
const unavailable = () =>
  new ApiFault(
    409,
    "invalid_state",
    "لا يتوفر سؤال تأكيدي مناسب لهذه النتيجة الحالية.",
  );
const enabled = () =>
  process.env.PH06_API_ENABLED === "true" &&
  process.env.KHOTWA_SYNTHETIC_DATA === "true";
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new ApiFault(500, "internal_error", "تعذر اعتماد مادة السؤال.");
  return v as Record<string, unknown>;
};
const code = (v: unknown): v is ErrorCode =>
  typeof v === "string" && /^ERR-ALG-0[1-6]$/.test(v);
type DiagnosisRow = {
  id: string;
  attempt_id: string;
  attempt_revision: bigint;
  verification_result_id: string;
  release_id: string;
  template_id: string | null;
  candidate_json: unknown;
  basis_json: unknown;
};
async function available(tx: Tx, d: DiagnosisRow): Promise<boolean> {
  const basis = record(d.basis_json),
    patterns = record(basis.catalogVersions);
  const rows = await tx.$queryRaw<
    { error_code: string; catalog_version: string }[]
  >`SELECT error_code,catalog_version FROM misconception_catalog WHERE release_id=${d.release_id}::uuid AND enabled AND is_synthetic FOR SHARE`;
  if (d.template_id) {
    const [template] = await tx.$queryRaw<
      { template_version: string }[]
    >`SELECT template_version FROM diagnostic_templates WHERE id=${d.template_id}::uuid AND release_id=${d.release_id}::uuid AND enabled AND is_synthetic FOR SHARE`;
    if (!template || template.template_version !== basis.templateVersion)
      return false;
  }
  return (
    rows.length > 0 &&
    Object.entries(patterns).every(([k, v]) =>
      rows.some((r) => r.error_code === k && r.catalog_version === v),
    )
  );
}
export async function projectDiagnosis(
  tx: Tx,
  report: Schema<"VerificationReport">,
  latest = true,
): Promise<Schema<"VerificationReport">> {
  const initial = report.diagnosisCandidate;
  if (!initial?.diagnosisId) return report;
  const empty = { ...report, diagnosisCandidate: null };
  if (!enabled() || !report.isCurrent) return empty;
  const [d] = await tx.$queryRaw<
    DiagnosisRow[]
  >`SELECT d.* FROM current_diagnoses d JOIN attempts a ON a.id=d.attempt_id JOIN learning_sessions l ON l.id=a.learning_session_id WHERE d.id=${initial.diagnosisId}::uuid AND d.diagnosis_policy_version=${DIAGNOSIS_POLICY} AND l.is_synthetic`;
  if (!d || !(await available(tx, d))) return empty;
  if (d.template_id) {
    const [template] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM diagnostic_templates WHERE id=${d.template_id}::uuid AND release_id=${d.release_id}::uuid AND enabled AND is_synthetic`;
    if (!template) return empty;
  }
  if (latest) {
    const [response] = await tx.$queryRaw<
      { result_json: unknown }[]
    >`SELECT r.result_json FROM probe_responses r JOIN diagnostic_probes p ON p.id=r.probe_id WHERE p.diagnosis_id=${d.id}::uuid`;
    if (response)
      return {
        ...report,
        diagnosisCandidate: output("ProbeEvaluation", response.result_json)
          .diagnosis,
      };
  }
  return report;
}
export class DiagnosisService {
  constructor(
    readonly store: Store,
    readonly active = false,
  ) {
    if (active && !store.syntheticData)
      throw new Error(
        "PH-06 requires an explicitly synthetic review environment while Gate-1 is blocked",
      );
  }
  private async skill(
    tx: Tx,
    release: string,
    pattern: ErrorCode,
    family: string | null,
  ): Promise<string | null> {
    // Curriculum 05/06 maps integer arithmetic to SK02/03 only. A numeric
    // division observation is not permission to relabel it SK06; until content
    // owners resolve that family we retain an unresolved, unassigned cause.
    if (pattern === "ERR-ALG-05" && family === "calculation_divide")
      return null;
    const contextual =
      pattern === "ERR-ALG-04" && family === "inverse_add"
        ? "SK-ALG-05"
        : pattern === "ERR-ALG-05" && family === "calculation_signed"
          ? "SK-ALG-02"
          : null;
    if (contextual) {
      const [row] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM skills WHERE release_id=${release}::uuid AND skill_code=${contextual} AND status='active'`;
      return row?.id ?? null;
    }
    const [row] = await tx.$queryRaw<
      { skill_id: string }[]
    >`SELECT skill_id FROM misconception_catalog WHERE release_id=${release}::uuid AND error_code=${pattern} AND enabled AND is_synthetic`;
    return row?.skill_id ?? null;
  }
  async persist(
    tx: Tx,
    a: AttemptRow,
    verdicts: Schema<"TransitionVerdict">[],
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<Candidate | null> {
    if (!this.active || a.attempt_kind === "transfer") return null;
    const index = verdicts.findIndex((v) => v.mathStatus !== "verified_valid"),
      verdict = verdicts[index];
    if (!verdict) return null;
    const h = observeTransition(
      before,
      after,
      verdict,
      verdicts.slice(0, index).every((v) => v.mathStatus === "verified_valid"),
    );
    if (!h) return null;
    const [learning] = await tx.$queryRaw<
      { release_id: string; is_synthetic: boolean }[]
    >`SELECT release_id,is_synthetic FROM learning_sessions WHERE id=${a.learning_session_id}::uuid`;
    if (!learning?.is_synthetic) return null;
    const [previous] = await tx.$queryRaw<
      DiagnosisRow[]
    >`SELECT * FROM current_diagnoses WHERE attempt_id=${a.id}::uuid AND attempt_revision=${a.revision} AND diagnosis_policy_version=${DIAGNOSIS_POLICY}`;
    if (previous) {
      if (!(await available(tx, previous))) return null;
      const [answered] = await tx.$queryRaw<
        { result_json: unknown }[]
      >`SELECT r.result_json FROM probe_responses r JOIN diagnostic_probes p ON p.id=r.probe_id WHERE p.diagnosis_id=${previous.id}::uuid`;
      return answered
        ? output("ProbeEvaluation", answered.result_json).diagnosis
        : output("DiagnosisCandidate", previous.candidate_json);
    }
    const catalog = await tx.$queryRaw<
      { error_code: ErrorCode; skill_id: string; catalog_version: string }[]
    >`SELECT error_code,skill_id,catalog_version FROM misconception_catalog WHERE release_id=${learning.release_id}::uuid AND enabled AND is_synthetic FOR SHARE`;
    if (
      !catalog.length ||
      (h.primary !== null && !catalog.some((r) => r.error_code === h.primary))
    )
      return null;
    h.candidates = h.candidates.filter((c) =>
      catalog.some((r) => r.error_code === c),
    );
    const [template] = h.family
      ? await tx.$queryRaw<
          { id: string; template_version: string }[]
        >`SELECT id,template_version FROM diagnostic_templates WHERE release_id=${learning.release_id}::uuid AND family=${h.family} AND enabled AND is_synthetic ORDER BY template_version DESC,id LIMIT 1 FOR SHARE`
      : [];
    const id = randomUUID(),
      targetSkill = h.primary
        ? await this.skill(tx, learning.release_id, h.primary, h.family)
        : null,
      hasProbe = !!template && h.primary !== null && targetSkill !== null;
    const candidate = output("DiagnosisCandidate", {
      diagnosisId: id,
      state: hasProbe ? h.state : "unresolved",
      errorCode: hasProbe ? h.primary : null,
      skillId: hasProbe ? targetSkill : null,
      explanationAr:
        h.observation +
        " هذا تفسير محتمل في هذه المحاولة، وليس تشخيصًا دائمًا. السؤال الإضافي قد يدعمه أو يناقضه.",
      needsProbe: hasProbe,
    });
    const hash = (v: unknown) =>
      createHash("sha256").update(JSON.stringify(v)).digest("hex");
    const basis = {
      candidates: h.candidates,
      family: h.family,
      observation: h.observation,
      firstBlockingIndex: index,
      engineVersion: verdict.engineVersion,
      notationProfileVersion: verdict.notationProfileVersion,
      from: verdict.from,
      to: verdict.to,
      beforeAstSha256: hash(before),
      afterAstSha256: hash(after),
      evidence: verdict.evidence,
      catalogVersions: Object.fromEntries(
        catalog
          .filter((c) => h.candidates.includes(c.error_code))
          .map((c) => [c.error_code, c.catalog_version]),
      ),
      templateVersion: template?.template_version ?? null,
      syntheticReviewOnly: true,
      boundedPrecedingTransitions: verdicts
        .slice(Math.max(0, index - 2), index + 1)
        .map((v) => ({
          from: v.from,
          to: v.to,
          mathStatus: v.mathStatus,
          evidence: v.evidence,
        })),
    };
    await tx.$executeRaw`INSERT INTO diagnoses(id,attempt_id,verification_result_id,attempt_revision,release_id,template_id,diagnosis_policy_version,candidate_json,basis_json) VALUES(${id}::uuid,${a.id}::uuid,${verdict.verificationResultId}::uuid,${a.revision},${learning.release_id}::uuid,${template?.id ?? null}::uuid,${DIAGNOSIS_POLICY},${JSON.stringify(candidate)}::jsonb,${JSON.stringify(basis)}::jsonb)`;
    return candidate;
  }
  private async current(
    tx: Tx,
    auth: GuestAuth,
    attemptId: string,
    revision: number,
  ): Promise<AttemptRow> {
    if (!this.active)
      throw new ApiFault(404, "not_found", "المسار غير متاح في هذه النسخة.");
    const a = await this.store.readAttemptInTransaction(tx, auth, attemptId);
    if (Number(a.revision) !== revision)
      throw new ApiFault(
        409,
        "revision_conflict",
        "تغيّرت المحاولة؛ السؤال السابق لم يعد صالحًا لهذه النسخة.",
        [],
        Number(a.revision),
      );
    const [l] = await tx.$queryRaw<
      { is_synthetic: boolean }[]
    >`SELECT is_synthetic FROM learning_sessions WHERE id=${a.learning_session_id}::uuid`;
    if (!l?.is_synthetic || a.status === "stopped") throw unavailable();
    await requireUnassistedProbe(tx, a);
    return a;
  }
  private async diagnosis(
    tx: Tx,
    a: AttemptRow,
    resultId: string,
  ): Promise<DiagnosisRow> {
    const [d] = await tx.$queryRaw<
      DiagnosisRow[]
    >`SELECT d.* FROM current_diagnoses d WHERE d.attempt_id=${a.id}::uuid AND d.attempt_revision=${a.revision} AND d.diagnosis_policy_version=${DIAGNOSIS_POLICY} AND EXISTS(SELECT 1 FROM verification_results v JOIN current_verification_runs r ON r.id=v.verification_run_id JOIN verification_runs source_run ON source_run.id=r.id JOIN verification_reports p ON p.id=source_run.report_id WHERE v.id=${resultId}::uuid AND r.attempt_id=d.attempt_id AND r.attempt_revision_requested=d.attempt_revision AND v.math_status='verified_invalid' AND p.scope='current_sequence' AND p.dispatch_status='finished' AND (p.report_json->'transitions'->((p.report_json->>'firstBlockingTransitionIndex')::int)->>'verificationResultId')=v.id::text)`;
    if (!d || !(await available(tx, d))) throw unavailable();
    return d;
  }
  async createProbe(
    auth: GuestAuth,
    attemptId: string,
    key: string,
    body: Schema<"RequestProbeInput">,
  ) {
    const check = async (tx: Tx) => {
      const a = await this.current(tx, auth, attemptId, body.expectedRevision);
      return this.diagnosis(tx, a, body.verificationResultId);
    };
    return this.store.mutate(
      auth,
      "probe.create",
      key,
      { attemptId: attemptId.toLowerCase(), body },
      async (tx) => {
        const d = await check(tx);
        if (!d.template_id) throw unavailable();
        const [t] = await tx.$queryRaw<
          {
            question_ar: string;
            options_json: unknown;
            rules_json: unknown;
            template_version: string;
          }[]
        >`SELECT question_ar,options_json,rules_json,template_version FROM diagnostic_templates WHERE id=${d.template_id}::uuid AND release_id=${d.release_id}::uuid AND enabled AND is_synthetic FOR SHARE`;
        if (!t || record(d.basis_json).templateVersion !== t.template_version)
          throw unavailable();
        const [old] = await tx.$queryRaw<
          { public_json: unknown; answered: boolean }[]
        >`SELECT p.public_json,EXISTS(SELECT 1 FROM probe_responses WHERE probe_id=p.id) AS answered FROM diagnostic_probes p WHERE diagnosis_id=${d.id}::uuid`;
        if (old) {
          if (old.answered) throw unavailable();
          return { status: 201, data: output("Probe", old.public_json) };
        }
        if (!Array.isArray(t.options_json)) throw unavailable();
        const rules = record(t.rules_json),
          privateRules: Record<string, unknown> = {};
        const options = t.options_json.map((v) => {
          const o = record(v);
          if (
            typeof o.id !== "string" ||
            typeof o.labelAr !== "string" ||
            !Object.hasOwn(rules, o.id)
          )
            throw unavailable();
          const id = randomUUID();
          privateRules[id] = rules[o.id];
          return { id, labelAr: o.labelAr };
        });
        for (let i = options.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [options[i], options[j]] = [options[j]!, options[i]!];
        }
        const probe = output("Probe", {
          id: randomUUID(),
          attemptId: d.attempt_id,
          attemptRevision: Number(d.attempt_revision),
          diagnosisId: d.id,
          questionAr: t.question_ar,
          responseMode: "choice",
          options,
          status: "open",
        });
        await tx.$executeRaw`INSERT INTO diagnostic_probes(id,diagnosis_id,template_id,public_json,private_rules_json,template_version) VALUES(${probe.id}::uuid,${d.id}::uuid,${d.template_id}::uuid,${JSON.stringify(probe)}::jsonb,${JSON.stringify(privateRules)}::jsonb,${t.template_version})`;
        return { status: 201, data: probe };
      },
      false,
      async (tx, cached) => {
        await check(tx);
        return cached;
      },
    );
  }
  async answerProbe(
    auth: GuestAuth,
    attemptId: string,
    probeId: string,
    key: string,
    body: Schema<"AnswerProbeInput">,
  ) {
    const check = async (tx: Tx) => {
      const a = await this.current(tx, auth, attemptId, body.expectedRevision);
      const [p] = await tx.$queryRaw<
        {
          diagnosis_id: string;
          private_rules_json: unknown;
          template_version: string;
          verification_result_id: string;
          template_id: string;
        }[]
      >`SELECT p.diagnosis_id,p.private_rules_json,p.template_version,p.template_id,d.verification_result_id FROM diagnostic_probes p JOIN diagnoses d ON d.id=p.diagnosis_id WHERE p.id=${probeId}::uuid AND d.attempt_id=${a.id}::uuid`;
      if (!p) throw new ApiFault(404, "not_found", "المورد غير متاح.");
      const d = await this.diagnosis(tx, a, p.verification_result_id);
      const [t] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM diagnostic_templates WHERE id=${p.template_id}::uuid AND release_id=${d.release_id}::uuid AND template_version=${p.template_version} AND enabled AND is_synthetic FOR SHARE`;
      if (!t) throw unavailable();
      return { p, d };
    };
    return this.store.mutate(
      auth,
      "probe.answer",
      key,
      {
        attemptId: attemptId.toLowerCase(),
        probeId: probeId.toLowerCase(),
        body,
      },
      async (tx) => {
        const { p, d } = await check(tx);
        const [old] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM probe_responses WHERE probe_id=${probeId}::uuid`;
        if (old)
          throw new ApiFault(
            409,
            "invalid_state",
            "حُفظ جواب لهذا السؤال؛ لا يُحسب جواب ثانٍ دليلًا مستقلًا.",
          );
        const initial = output("DiagnosisCandidate", d.candidate_json),
          basis = record(d.basis_json);
        const candidates = Array.isArray(basis.candidates)
          ? basis.candidates.filter(code)
          : [];
        let evaluation: Schema<"ProbeEvaluation">["evaluation"] = "unverified",
          state: Candidate["state"] = "unresolved",
          selected: ErrorCode | null = null;
        if (body.answer.kind === "choice") {
          const rules = record(p.private_rules_json);
          if (!Object.hasOwn(rules, body.answer.optionId))
            throw new ApiFault(
              422,
              "invalid_input",
              "اختر إجابة من خيارات السؤال الحالي.",
            );
          const rule = record(rules[body.answer.optionId]);
          const support = Array.isArray(rule.supports)
            ? rule.supports.filter(code).filter((c) => candidates.includes(c))
            : [];
          const reject = Array.isArray(rule.rejects)
            ? rule.rejects.filter(code).filter((c) => candidates.includes(c))
            : [];
          if (support.length === 1) {
            evaluation = "supported";
            state = "supported_by_probe";
            selected = support[0]!;
          } else if (reject.length) {
            evaluation = "not_supported";
            state = candidates.every((c) => reject.includes(c))
              ? "rejected"
              : "unresolved";
            selected =
              state === "rejected"
                ? (initial.errorCode as ErrorCode | null)
                : null;
          } else evaluation = "unclear";
        }
        const skillId = selected
          ? await this.skill(
              tx,
              d.release_id,
              selected,
              typeof basis.family === "string" ? basis.family : null,
            )
          : null;
        const explanation =
          state === "supported_by_probe"
            ? "الجواب يتسق مع فرضية محددة في هذه المحاولة فقط؛ لا يثبت ضعفًا دائمًا أو إتقانًا."
            : state === "rejected"
              ? "الجواب يقدم قرينة ضد الفرضية السابقة؛ يبقى سبب الخطأ الأول غير مؤكد، ولا يتغير الحكم الرياضي."
              : "لم يكف الجواب لحسم سبب الخطأ الأول؛ لا نستنتج تعثرًا مفاهيميًا أو درجة مهارة.";
        const diagnosis = output("DiagnosisCandidate", {
          diagnosisId: d.id,
          state,
          errorCode: selected,
          skillId,
          explanationAr: explanation,
          needsProbe: false,
        });
        const result = output("ProbeEvaluation", {
          probeId: probeId.toLowerCase(),
          attemptId: d.attempt_id,
          attemptRevision: Number(d.attempt_revision),
          evaluation,
          diagnosis,
          feedbackAr: explanation,
          nextAction: "continue",
        });
        await tx.$executeRaw`INSERT INTO probe_responses(id,probe_id,response_raw,response_evaluation,result_json,assistance_level,diagnosis_policy_version) VALUES(${randomUUID()}::uuid,${probeId}::uuid,${JSON.stringify(body.answer)}::jsonb,${evaluation},${JSON.stringify(result)}::jsonb,'H0',${DIAGNOSIS_POLICY})`;
        return { status: 201, data: result };
      },
      false,
      async (tx, cached) => {
        await check(tx);
        return cached;
      },
    );
  }
}
