import {
  ph08Active,
  requireAssignmentCurrent,
  transferLearningKind,
} from "./learning";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiFault } from "./http";
import { output, Schema } from "./contracts";
import type { AttemptRow, GuestAuth, Store } from "./store";
import type { MathPort } from "./math-gateway";
import { projectDiagnosis } from "./diagnosis";
import {
  AiTutorPort,
  DraftResult,
  buildHintContext,
  composeWithDeadline,
  HINT_SYSTEM_PROMPT,
  HintContext,
  safeTeachingText,
} from "./ai-tutor";
import {
  hintLevel,
  HINT_PROMPT_VERSION,
  nextHintLevel,
  TUTORING_POLICY,
} from "./tutoring-policy";
type Tx = Prisma.TransactionClient;
type Event = Schema<"TutoringEvent">;
export interface TutoringLimits {
  requestTimeoutMs: number;
  aiTimeoutMs: number;
  maxInputBytes: number;
  maxOutputTokens: number;
  guestCalls: number;
  globalCalls: number;
  guestCostUnits: number;
  globalCostUnits: number;
  maxParallel: number;
}
type Template = {
  id: string;
  release_id: string;
  problem_revision_id: string | null;
  error_code: string | null;
  hint_level: number;
  template_version: string;
  policy_version: string;
  text_ar: string;
  allowed_rephrases: unknown;
  math_assertions: unknown;
  solution_steps: unknown;
  review_status: "draft" | "reviewed";
  reviewed_by_role: string | null;
  reviewed_at: Date | null;
  enabled: boolean;
  is_synthetic: boolean;
};
interface Current {
  a: AttemptRow;
  original: string;
  releaseId: string;
  report: Schema<"VerificationReport"> | null;
  pattern: string | null;
  diagnosisId: string | null;
  anchor: string | null;
  verification: string | null;
  contextKey: string;
  signature: string;
  assessable: boolean;
  openProbe: boolean;
}
interface Snapshot {
  id: string;
  recordId: string;
  current: Current;
  template: Template;
  level: 1 | 2 | 3 | 4;
  variants: string[];
  assertions: string[];
  steps: string[];
  hash: string;
  aiContext: HintContext | null;
  aiReserved: boolean;
  cost: number;
  providerReason: string;
  deadline: Date;
  started: number;
}
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const bytes = (hex: string) => Buffer.from(hex, "hex");
const unavailable = () =>
  new ApiFault(
    503,
    "ai_unavailable",
    "المساعدة التعليمية غير متاحة لهذا الموضع الآن. بقي حلّك محفوظًا ولم يتغير الحكم الرياضي.",
  );
const stale = (revision: number) =>
  new ApiFault(
    409,
    "revision_conflict",
    "تغير سياق المحاولة أو المساعدة؛ لن نعرض تلميحًا لنسخة قديمة.",
    [],
    revision,
  );
function strings(value: unknown, max: number, length: number): string[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some(
      (v) => typeof v !== "string" || !v.length || [...v].length > length,
    )
  )
    throw unavailable();
  return value as string[];
}
function templateContent(t: Template) {
  const variants = strings(t.allowed_rephrases, 6, 1200),
    assertions = strings(t.math_assertions, 6, 256),
    steps = strings(t.solution_steps, 12, 256);
  for (const text of [t.text_ar, ...variants]) {
    if (!safeTeachingText(text)) throw unavailable();
    if (t.hint_level < 3 && /[=٠-٩×÷]/u.test(text)) throw unavailable();
    let rest = text;
    for (const assertion of assertions) rest = rest.replaceAll(assertion, "");
    if (t.hint_level === 3 && /[=٠-٩×÷]/u.test(rest)) throw unavailable();
  }
  if (
    (t.hint_level < 3 && assertions.length) ||
    (t.hint_level < 4 && steps.length) ||
    (t.hint_level === 4 && !steps.length)
  )
    throw unavailable();
  return { variants, assertions, steps };
}
export class TutoringService {
  constructor(
    readonly store: Store,
    readonly math: MathPort,
    readonly ai: AiTutorPort,
    readonly limits: TutoringLimits,
    readonly active = false,
  ) {
    if (active && !store.syntheticData)
      throw new Error("PH-07 requires explicitly synthetic review data");
    for (const value of Object.values(limits))
      if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647)
        throw new Error("Explicit bounded PH-07 test limits required");
    if (limits.aiTimeoutMs >= limits.requestTimeoutMs)
      throw new Error("AI timeout must fit inside whole-request deadline");
  }
  private async current(tx: Tx, auth: GuestAuth, id: string): Promise<Current> {
    const a = await this.store.readAttemptInTransaction(tx, auth, id);
    if (ph08Active()) await requireAssignmentCurrent(tx, a.id);
    const [p] = await tx.$queryRaw<
      {
        original_equation_raw: string;
        release_id: string;
        is_synthetic: boolean;
      }[]
    >`SELECT p.original_equation_raw,l.release_id,l.is_synthetic FROM problem_revisions p JOIN learning_sessions l ON l.id=${a.learning_session_id}::uuid WHERE p.id=${a.problem_revision_id}::uuid AND p.release_id=l.release_id`;
    if (!p?.is_synthetic || !p.original_equation_raw || a.status === "stopped")
      throw new ApiFault(
        409,
        "invalid_state",
        "المساعدة غير متاحة في سياق هذه المحاولة.",
      );
    const [row] = await tx.$queryRaw<
      { report_json: unknown }[]
    >`SELECT report_json FROM verification_reports WHERE attempt_id=${a.id}::uuid AND attempt_revision=${a.revision} AND problem_revision_id=${a.problem_revision_id}::uuid AND notation_profile=${a.notation_profile} AND engine_version='0.3.0' AND scope='current_sequence' AND dispatch_status='finished' AND report_json->>'isCurrent'='true' ORDER BY finished_at DESC,id DESC LIMIT 1`;
    const report = row
      ? await projectDiagnosis(
          tx,
          output("VerificationReport", row.report_json),
        )
      : null;
    const steps = await this.store.readStepsInTransaction(tx, a.id);
    const index = report
      ? (report.firstBlockingTransitionIndex ?? report.transitions.length - 1)
      : -1;
    const edge = report?.transitions[index];
    const target = edge
      ? steps.find(
          (s) =>
            s.id === edge.to.stepId &&
            s.current_version === edge.to.stepVersion,
        )
      : null;
    const assessable = report
      ? !!target &&
        (edge?.mathStatus === "verified_valid" ||
          edge?.mathStatus === "verified_invalid")
      : steps.length === 0;
    if (
      report &&
      (report.attemptRevision !== Number(a.revision) ||
        report.problemRevisionId !== a.problem_revision_id ||
        report.transitions.some(
          (t) =>
            !steps.some(
              (s) =>
                s.id === t.to.stepId && s.current_version === t.to.stepVersion,
            ),
        ))
    )
      throw stale(Number(a.revision));
    const diagnosis = report?.diagnosisCandidate;
    const pattern =
      diagnosis && !["rejected", "unresolved"].includes(diagnosis.state)
        ? diagnosis.errorCode
        : null;
    const prefix = target
      ? steps
          .slice(0, steps.findIndex((s) => s.id === target.id) + 1)
          .map((s) => s.version_id)
      : [];
    const contextKey = digest({
      problem: a.problem_revision_id,
      notation: a.notation_profile,
      prefix,
      pattern,
    });
    const [probe] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT p.id FROM diagnostic_probes p JOIN current_diagnoses d ON d.id=p.diagnosis_id WHERE d.attempt_id=${a.id}::uuid AND NOT EXISTS(SELECT 1 FROM probe_responses r WHERE r.probe_id=p.id)`;
    return {
      a,
      original: p.original_equation_raw,
      releaseId: p.release_id,
      report,
      pattern,
      diagnosisId: diagnosis?.diagnosisId ?? null,
      anchor: target?.version_id ?? null,
      verification: edge?.verificationResultId ?? null,
      contextKey,
      signature: digest({
        contextKey,
        reportId: report?.id ?? null,
        diagnosis,
        allVersions: steps.map((s) => s.version_id),
      }),
      assessable,
      openProbe: !!probe,
    };
  }
  private async reserveAi(
    tx: Tx,
    auth: GuestAuth,
    job: string,
    context: HintContext,
  ): Promise<{ reserved: boolean; cost: number; reason: string }> {
    if (!this.ai.enabled)
      return { reserved: false, cost: 0, reason: "AI_DISABLED_OWNER_DECISION" };
    if (
      Buffer.byteLength(HINT_SYSTEM_PROMPT) +
        Buffer.byteLength(JSON.stringify(context)) >
      this.limits.maxInputBytes
    )
      return { reserved: false, cost: 0, reason: "AI_INPUT_LIMIT" };
    const cost = this.ai.maximumCostUnits;
    if (!Number.isSafeInteger(cost) || cost <= 0 || cost > 2147483647)
      return { reserved: false, cost: 0, reason: "AI_COST_QUOTE_INVALID" };
    const day = new Date().toISOString().slice(0, 10),
      scopes = ["global", "guest:" + auth.row.id];
    for (const scope of scopes)
      await tx.$executeRaw`INSERT INTO ai_budget_ledgers(scope,day) VALUES(${scope},${day}::date) ON CONFLICT DO NOTHING`;
    const buckets = [];
    for (const scope of scopes) {
      const [bucket] = await tx.$queryRaw<
        { scope: string; calls_reserved: number; cost_units_reserved: number }[]
      >`SELECT * FROM ai_budget_ledgers WHERE scope=${scope} AND day=${day}::date FOR UPDATE`;
      if (!bucket) throw unavailable();
      buckets.push(bucket);
    }
    const [parallel] = await tx.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM hint_requests WHERE dispatch_status='running' AND ai_reserved AND deadline_at>now() AND id<>${job}::uuid`;
    if (Number(parallel?.n ?? 0) >= this.limits.maxParallel)
      return { reserved: false, cost: 0, reason: "AI_PARALLEL_LIMIT" };
    for (const [i, bucket] of buckets.entries())
      if (
        bucket.calls_reserved >=
          (i === 0 ? this.limits.globalCalls : this.limits.guestCalls) ||
        bucket.cost_units_reserved + cost >
          (i === 0 ? this.limits.globalCostUnits : this.limits.guestCostUnits)
      )
        return { reserved: false, cost: 0, reason: "AI_BUDGET_LIMIT" };
    for (const scope of scopes)
      await tx.$executeRaw`UPDATE ai_budget_ledgers SET calls_reserved=calls_reserved+1,cost_units_reserved=cost_units_reserved+${cost} WHERE scope=${scope} AND day=${day}::date`;
    return { reserved: true, cost, reason: "AI_RESERVED" };
  }
  private async prepare(
    auth: GuestAuth,
    attemptId: string,
    key: string,
    body: Schema<"HintInput">,
  ): Promise<{ cached: Event } | { snapshot: Snapshot }> {
    return this.store.db.$transaction(
      async (tx) => {
        await this.store.authorizeInTransaction(tx, auth);
        const a = await this.store.readAttemptInTransaction(
          tx,
          auth,
          attemptId,
        );
        const keyHash = bytes(this.store.security.keyDigest(key)),
          fingerprint = bytes(
            this.store.security.fingerprint({ attemptId: a.id, body }),
          );
        const [old] = await tx.$queryRaw<
          {
            id: string;
            fingerprint: Uint8Array;
            state: string;
            response_cache: unknown;
          }[]
        >`SELECT id,fingerprint,state,response_cache FROM idempotency_records WHERE guest_session_id=${auth.row.id}::uuid AND operation='attempt.hint' AND key_digest=${keyHash} FOR UPDATE`;
        if (old && !Buffer.from(old.fingerprint).equals(fingerprint))
          throw new ApiFault(
            409,
            "idempotency_conflict",
            "استُخدم مفتاح الإرسال مع طلب مختلف.",
          );
        if (Number(a.revision) !== body.expectedRevision)
          throw stale(Number(a.revision));
        if (old?.state === "completed") {
          const event = output("TutoringEvent", old.response_cache);
          const [t] = await tx.$queryRaw<
            { enabled: boolean; context_key: string }[]
          >`SELECT t.enabled,e.context_key FROM tutoring_events e JOIN intervention_templates t ON t.id=e.template_id WHERE e.id=${event.id}::uuid AND e.attempt_id=${a.id}::uuid AND t.policy_version=${TUTORING_POLICY}`;
          const current = await this.current(tx, auth, a.id);
          if (
            !t?.enabled ||
            t.context_key !== current.contextKey ||
            current.openProbe ||
            !current.assessable
          )
            throw stale(Number(a.revision));
          return { cached: event };
        }
        await tx.$executeRaw`UPDATE hint_requests SET dispatch_status='failed',outcome_code='LEASE_EXPIRED',finished_at=now() WHERE attempt_id=${a.id}::uuid AND dispatch_status='running' AND deadline_at<=now()`;
        const [running] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM hint_requests WHERE attempt_id=${a.id}::uuid AND dispatch_status='running'`;
        if (running)
          throw new ApiFault(
            409,
            "request_in_progress",
            "طلب التلميح قيد التنفيذ؛ انتظر ثم أعد الطلب نفسه.",
            [],
            null,
            1,
          );
        const current = await this.current(tx, auth, a.id);
        const [last] = await tx.$queryRaw<
          { level: number | null }[]
        >`SELECT max(hint_level)::int AS level FROM tutoring_events WHERE attempt_id=${a.id}::uuid AND context_key=${current.contextKey} AND policy_version=${TUTORING_POLICY}`;
        const effectiveKind = await transferLearningKind(tx, current.a, body);
        const level = nextHintLevel(
          body,
          effectiveKind,
          Number(last?.level ?? 0),
          current.assessable &&
            (!!current.report || body.action === "show_full_solution"),
          current.openProbe,
        );
        const [template] = await tx.$queryRaw<
          Template[]
        >`SELECT * FROM intervention_templates WHERE release_id=${current.releaseId}::uuid AND hint_level=${level} AND policy_version=${TUTORING_POLICY} AND enabled AND is_synthetic AND (problem_revision_id=${a.problem_revision_id}::uuid OR problem_revision_id IS NULL) AND (${level}=4 OR error_code IS NULL OR error_code=${current.pattern}) ORDER BY (problem_revision_id IS NOT NULL) DESC,(error_code IS NOT NULL) DESC,template_version DESC,id LIMIT 1 FOR SHARE`;
        if (
          !template ||
          (level === 4 &&
            template.problem_revision_id !== a.problem_revision_id)
        )
          throw unavailable();
        const content = templateContent(template),
          id = randomUUID(),
          recordId = old?.id ?? randomUUID(),
          deadline = new Date(Date.now() + this.limits.requestTimeoutMs);
        const aiContext =
          level < 4
            ? buildHintContext({
                level: level as 1 | 2 | 3,
                templateId: template.id,
                contentVersion: template.template_version,
                textAr: template.text_ar,
                variants: content.variants,
                skillNameAr: "الجبر الخطي بمجهول واحد",
                observationAr:
                  current.report?.firstBlockingTransitionIndex !== null
                    ? "هناك انتقال يحتاج مراجعة؛ السبب المفاهيمي غير مؤكد."
                    : "سياق رياضي متحقق؛ لا تصنيف لضعف الطالب.",
                maxOutputTokens: this.limits.maxOutputTokens,
              })
            : null;
        if (!old)
          await tx.$executeRaw`INSERT INTO idempotency_records(id,guest_session_id,operation,key_digest,fingerprint,state,expires_at) VALUES(${recordId}::uuid,${auth.row.id}::uuid,'attempt.hint',${keyHash},${fingerprint},'processing',${auth.row.expires_at})`;
        await tx.$executeRaw`UPDATE idempotency_records SET state='processing',response_cache=${JSON.stringify({ runningHintId: id })}::jsonb,response_code=NULL WHERE id=${recordId}::uuid`;
        const reservation = aiContext
          ? await this.reserveAi(tx, auth, id, aiContext)
          : { reserved: false, cost: 0, reason: "H4_VERIFIED_CONTENT_ONLY" };
        const hash = digest(template);
        await tx.$executeRaw`INSERT INTO hint_requests(id,attempt_id,attempt_revision,problem_revision_id,idempotency_record_id,assistance_revision,anchor_step_version_id,verification_result_id,diagnosis_id,template_id,hint_level,policy_version,prompt_version,content_hash,context_key,ai_reserved,cost_units_reserved,dispatch_status,deadline_at)
      VALUES(${id}::uuid,${a.id}::uuid,${a.revision},${a.problem_revision_id}::uuid,${recordId}::uuid,${current.a.assistance_revision ?? 0},${current.anchor}::uuid,${current.verification}::uuid,${current.diagnosisId}::uuid,${template.id}::uuid,${level},${TUTORING_POLICY},${HINT_PROMPT_VERSION},${hash},${current.contextKey},${reservation.reserved},${reservation.cost},'running',${deadline})`;
        return {
          snapshot: {
            id,
            recordId,
            current,
            template,
            level,
            ...content,
            hash,
            aiContext,
            aiReserved: reservation.reserved,
            cost: reservation.cost,
            providerReason: reservation.reason,
            deadline,
            started: Date.now(),
          },
        };
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }
  private async mathProof(s: Snapshot, signal: AbortSignal): Promise<unknown> {
    const context: Schema<"InternalMathContext"> = {
      attemptId: s.current.a.id,
      attemptRevision: Number(s.current.a.revision),
      problemRevisionId: s.current.a.problem_revision_id,
      notationProfile: s.current.a.notation_profile,
      domain: "reals",
    };
    const proofs = [];
    for (const assertion of s.assertions) {
      const r = await this.math.verify(
        context,
        {
          fromKind: "problem",
          fromStepVersionId: null,
          toStepVersionId: randomUUID(),
          fromRaw: "٠ = ٠",
          toRaw: assertion,
        },
        signal,
      );
      if (
        r.status !== "verified_valid" ||
        r.evidence?.previousSolution?.kind !== "all_reals" ||
        r.evidence?.nextSolution?.kind !== "all_reals"
      )
        throw new ApiFault(
          503,
          "math_unavailable",
          "تعذر إثبات الجزء الرياضي في التلميح؛ لم نعرضه.",
        );
      proofs.push({
        assertionHash: digest(assertion),
        status: r.status,
        engine: r.engineVersion,
        evidence: r.evidence,
      });
    }
    if (s.level === 4) {
      let previous = s.current.original,
        previousId: string | null = null;
      for (const raw of s.steps) {
        const id = randomUUID();
        const r = await this.math.verify(
          context,
          {
            fromKind: previousId ? "step" : "problem",
            fromStepVersionId: previousId,
            toStepVersionId: id,
            fromRaw: previous,
            toRaw: raw,
          },
          signal,
        );
        if (r.status !== "verified_valid")
          throw new ApiFault(
            503,
            "math_unavailable",
            "تعذر التحقق من الحل المعتمد؛ لم يُعرض حل غير مثبت.",
          );
        proofs.push({
          fromHash: digest(previous),
          toHash: digest(raw),
          status: r.status,
          engine: r.engineVersion,
          evidence: r.evidence,
        });
        previous = raw;
        previousId = id;
      }
      const final = await this.math.checkFinal(
        context,
        s.current.original,
        { stepVersionId: previousId!, raw: previous },
        signal,
      );
      if (
        final.status !== "verified_valid" ||
        !final.isIsolated ||
        !final.substitutionValid ||
        final.originalSolution?.kind !== "singleton" ||
        final.finalSolution?.kind !== "singleton"
      )
        throw new ApiFault(
          503,
          "math_unavailable",
          "لم يثبت اكتمال الحل ومجاله؛ لم يُعرض.",
        );
      proofs.push({
        finalStatus: final.status,
        isolated: final.isIsolated,
        substitutionValid: final.substitutionValid,
        engine: final.engineVersion,
      });
    }
    if (Buffer.byteLength(JSON.stringify(proofs)) > 30000) throw unavailable();
    return proofs;
  }
  private async commit(
    auth: GuestAuth,
    s: Snapshot,
    text: string,
    reason: string,
    proof: unknown,
    usage?: DraftResult,
  ): Promise<Event> {
    return this.store.db.$transaction(
      async (tx) => {
        await this.store.authorizeInTransaction(tx, auth);
        const current = await this.current(tx, auth, s.current.a.id);
        const [job] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM hint_requests WHERE id=${s.id}::uuid AND dispatch_status='running' AND deadline_at>now() FOR UPDATE`;
        if (!job) throw unavailable();
        const [template] = await tx.$queryRaw<
          Template[]
        >`SELECT * FROM intervention_templates WHERE id=${s.template.id}::uuid AND enabled AND is_synthetic FOR SHARE`;
        if (
          current.a.revision !== s.current.a.revision ||
          current.a.problem_revision_id !== s.current.a.problem_revision_id ||
          (current.a.assistance_revision ?? 0) !==
            (s.current.a.assistance_revision ?? 0) ||
          current.signature !== s.current.signature ||
          current.openProbe ||
          !template ||
          digest(template) !== s.hash ||
          process.env.PH07_API_ENABLED !== "true"
        )
          throw stale(Number(current.a.revision));
        const source: Event["generationSource"] =
          reason === "PH08_GENERATED_VALIDATED"
            ? "llm_validated"
            : s.template.review_status === "reviewed"
              ? "reviewed_template"
              : "manual";
        const fallback =
          s.aiContext !== null &&
          this.ai.enabled &&
          reason !== "AI_VALIDATED" &&
          reason !== "PH08_GENERATED_VALIDATED";
        const now = new Date(),
          event = output("TutoringEvent", {
            id: randomUUID(),
            attemptId: current.a.id,
            attemptRevision: Number(current.a.revision),
            eventType:
              s.level === 4 ? "full_solution" : fallback ? "fallback" : "hint",
            hintLevel: hintLevel(s.level),
            textAr: text,
            solutionStepsAr: s.level === 4 ? s.steps : [],
            generationSource: source,
            independentEvidenceEligible: false,
            createdAt: now.toISOString(),
          });
        const audit = {
          outcome: reason,
          providerKind: s.aiContext ? this.ai.kind : "not_used",
          actualLlmUsed: false,
          validatorAccepted:
            reason === "AI_VALIDATED" || reason === "PH08_GENERATED_VALIDATED",
          callReserved: s.aiReserved,
          reservedCostUnits: s.cost,
          costUnit: "synthetic_reservation_units",
          elapsedMs: Date.now() - s.started,
          promptVersion: HINT_PROMPT_VERSION,
          inputBytes: s.aiContext
            ? Buffer.byteLength(HINT_SYSTEM_PROMPT) +
              Buffer.byteLength(JSON.stringify(s.aiContext))
            : 0,
          maxOutputTokens: this.limits.maxOutputTokens,
          reportedInputTokens: usage?.inputTokens ?? null,
          reportedOutputTokens: usage?.outputTokens ?? null,
          ...this.ai.invocationAudit?.(),
        };
        await tx.$executeRaw`INSERT INTO tutoring_events(id,hint_request_id,attempt_id,attempt_revision,problem_revision_id,anchor_step_version_id,verification_result_id,diagnosis_id,template_id,event_type,hint_level,policy_version,prompt_version,content_version,context_key,rendered_text_ar,solution_steps,generation_source,independent_evidence_eligible,public_json,math_proof_json,audit_json)
      VALUES(${event.id}::uuid,${s.id}::uuid,${current.a.id}::uuid,${current.a.revision},${current.a.problem_revision_id}::uuid,${s.current.anchor}::uuid,${s.current.verification}::uuid,${s.current.diagnosisId}::uuid,${s.template.id}::uuid,${event.eventType},${s.level},${TUTORING_POLICY},${HINT_PROMPT_VERSION},${s.template.template_version},${s.current.contextKey},${text},${JSON.stringify(event.solutionStepsAr)}::jsonb,${source},false,${JSON.stringify(event)}::jsonb,${JSON.stringify(proof)}::jsonb,${JSON.stringify(audit)}::jsonb)`;
        await tx.$executeRaw`UPDATE attempts SET highest_hint_level_seen=GREATEST(highest_hint_level_seen,${s.level}),independent_evidence_eligible=false,full_solution_seen=full_solution_seen OR ${s.level === 4},assistance_revision=assistance_revision+1,status=CASE WHEN status='completed' THEN 'assisted_completed' ELSE status END,updated_at=now() WHERE id=${current.a.id}::uuid`;
        await tx.$executeRaw`UPDATE hint_requests SET dispatch_status='finished',outcome_code=${reason},finished_at=now() WHERE id=${s.id}::uuid`;
        await tx.$executeRaw`UPDATE idempotency_records SET state='completed',response_code=200,response_cache=${JSON.stringify(event)}::jsonb WHERE id=${s.recordId}::uuid`;
        return event;
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }
  async request(
    auth: GuestAuth,
    attemptId: string,
    key: string,
    body: Schema<"HintInput">,
  ): Promise<Event> {
    if (!this.active)
      throw new ApiFault(404, "not_found", "المسار غير متاح في هذه النسخة.");
    const prepared = await this.prepare(auth, attemptId, key, body);
    if ("cached" in prepared) return prepared.cached;
    const s = prepared.snapshot,
      controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.max(1, s.deadline.getTime() - Date.now()),
    );
    try {
      const proof = await this.mathProof(s, controller.signal);
      const result: DraftResult =
        s.aiContext && s.aiReserved
          ? await composeWithDeadline(
              this.ai,
              s.aiContext,
              controller.signal,
              this.limits.aiTimeoutMs,
              this.limits.maxOutputTokens,
            )
          : { text: null, reason: s.providerReason };
      if (controller.signal.aborted) throw unavailable();
      if (
        result.text === null &&
        s.aiContext !== null &&
        this.ai.kind === "gemini" &&
        this.ai.requiresReviewedFallback?.() &&
        s.template.review_status !== "reviewed"
      )
        throw unavailable();
      return await this.commit(
        auth,
        s,
        result.text ?? s.template.text_ar,
        result.reason,
        proof,
        result,
      );
    } catch (e) {
      await this.store.db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE hint_requests SET dispatch_status='failed',outcome_code=${e instanceof ApiFault && e.status === 409 ? "STALE_CONTEXT" : "SAFE_FAILURE"},finished_at=now() WHERE id=${s.id}::uuid AND dispatch_status='running'`;
        await tx.$executeRaw`UPDATE idempotency_records SET state='failed',response_code=NULL,response_cache=NULL WHERE id=${s.recordId}::uuid AND state='processing' AND response_cache->>'runningHintId'=${s.id}`;
      });
      if (e instanceof ApiFault) throw e;
      throw unavailable();
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
}
