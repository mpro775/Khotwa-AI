import { publicMathReport } from "./learning-policy";
import {
  ph08Active,
  requireAssignmentCurrent,
  recordLearningEvidence,
} from "./learning";
import { randomUUID } from "node:crypto";
import { ApiFault } from "./http";
import { output, Schema } from "./contracts";
import {
  FinalResult,
  MathPort,
  ParseResult,
  TransitionResult,
} from "./math-gateway";
import { GuestAuth, StepRow, Store } from "./store";
import { DiagnosisService, projectDiagnosis } from "./diagnosis";
import { hasAssistance } from "./assistance";

const ENGINE = "0.3.0";
const bytes = (hex: string) => Buffer.from(hex, "hex");
const conflict = (revision: number) =>
  new ApiFault(
    409,
    "revision_conflict",
    "تغيّرت المحاولة أثناء التحقق. أعد فحص النسخة الحالية.",
    [],
    revision,
  );
const unavailable = () =>
  new ApiFault(
    503,
    "math_unavailable",
    "تعذر التحقق الآن. خطواتك محفوظة؛ أعد المحاولة دون حكم على فهمك.",
  );
type Context = Schema<"InternalMathContext">;
interface Snapshot {
  id: string;
  recordId: string;
  context: Context;
  scope: Schema<"VerificationScope">;
  targetStepId: string | null;
  allVersionIds: string[];
  steps: StepRow[];
  originalRaw: string;
  keyHash: Buffer;
  deadline: Date;
}
type Prepared =
  | { cached: Schema<"VerificationReport"> }
  | { snapshot: Snapshot };
interface Computed {
  original: ParseResult;
  parses: Map<string, ParseResult>;
  transitions: TransitionResult[];
  final: FinalResult | null;
  completion: Schema<"Completion">;
}

/** Owns the capture/call/commit boundary. It never calls a service under a DB lock. */
export class VerificationService {
  constructor(
    readonly store: Store,
    readonly math: MathPort,
    readonly timeoutMs: number,
    readonly diagnosis?: DiagnosisService,
  ) {
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 2147483647
    )
      throw new Error("Explicit bounded verification deadline required");
  }
  private async prepare(
    auth: GuestAuth,
    attemptId: string,
    key: string,
    body: Schema<"VerifyInput">,
  ): Promise<Prepared> {
    return this.store.db.$transaction(async (tx) => {
      await this.store.authorizeInTransaction(tx, auth);
      const a = await this.store.readAttemptInTransaction(tx, auth, attemptId);
      if (ph08Active()) await requireAssignmentCurrent(tx, a.id);
      const keyHash = bytes(this.store.security.keyDigest(key));
      const fingerprint = bytes(
        this.store.security.fingerprint({ attemptId, body }),
      );
      const [existing] = await tx.$queryRaw<
        {
          id: string;
          fingerprint: Uint8Array;
          state: string;
          response_cache: unknown;
        }[]
      >`SELECT id,fingerprint,state,response_cache FROM idempotency_records WHERE guest_session_id=${auth.row.id}::uuid AND operation='attempt.verify' AND key_digest=${keyHash} FOR UPDATE`;
      if (existing) {
        if (!Buffer.from(existing.fingerprint).equals(fingerprint))
          throw new ApiFault(
            409,
            "idempotency_conflict",
            "استُخدم مفتاح الإرسال مع طلب مختلف.",
          );
        if (existing.state === "completed") {
          const report = output("VerificationReport", existing.response_cache);
          if (
            !report.isCurrent ||
            report.attemptRevision !== Number(a.revision) ||
            report.problemRevisionId !== a.problem_revision_id
          )
            throw conflict(Number(a.revision));
          return {
            cached: publicMathReport(
              a.attempt_kind,
              await projectDiagnosis(tx, report, false),
            ),
          };
        }
        const [running] = await tx.$queryRaw<
          { id: string; deadline_at: Date }[]
        >`SELECT id,deadline_at FROM verification_reports WHERE idempotency_record_id=${existing.id}::uuid AND dispatch_status='running' FOR UPDATE`;
        if (running && running.deadline_at.getTime() > Date.now())
          throw new ApiFault(
            409,
            "request_in_progress",
            "التحقق قيد التنفيذ. انتظر قليلًا ثم أعد الطلب نفسه.",
            [],
            null,
            1,
          );
        if (running)
          await tx.$executeRaw`UPDATE verification_reports SET dispatch_status='failed',finished_at=now() WHERE id=${running.id}::uuid`;
      }
      if (a.revision !== BigInt(body.expectedRevision))
        throw conflict(Number(a.revision));
      if (a.status === "stopped")
        throw new ApiFault(409, "invalid_state", "هذه المحاولة متوقفة.");
      const all = await this.store.readStepsInTransaction(tx, a.id);
      if (!all.length)
        throw new ApiFault(422, "invalid_input", "أضف خطوة محفوظة قبل التحقق.");
      const canonicalTarget = body.targetStepId?.toLowerCase() ?? null;
      const target =
        body.scope === "target_edge"
          ? all.findIndex((s) => s.id === canonicalTarget)
          : -1;
      if (body.scope === "target_edge" && target < 0)
        throw new ApiFault(404, "not_found", "المورد غير متاح.");
      const steps =
        body.scope === "current_sequence"
          ? all
          : all.slice(Math.max(0, target - 1), target + 1);
      const [p] = await tx.$queryRaw<
        { original_equation_raw: string | null }[]
      >`SELECT original_equation_raw FROM problem_revisions WHERE id=${a.problem_revision_id}::uuid`;
      if (!p?.original_equation_raw)
        throw new ApiFault(
          409,
          "content_version_conflict",
          "نسخة المسألة غير متاحة للتحقق.",
        );
      const recordId = existing?.id ?? randomUUID(),
        id = randomUUID(),
        deadline = new Date(Date.now() + this.timeoutMs);
      if (!existing)
        await tx.$executeRaw`INSERT INTO idempotency_records(id,guest_session_id,operation,key_digest,fingerprint,state,expires_at) VALUES(${recordId}::uuid,${auth.row.id}::uuid,'attempt.verify',${keyHash},${fingerprint},'processing',${auth.row.expires_at})`;
      await tx.$executeRaw`UPDATE idempotency_records SET state='processing',response_code=NULL,response_cache=${JSON.stringify({ runningReportId: id })}::jsonb WHERE id=${recordId}::uuid`;
      const allVersionIds = all.map((s) => s.version_id);
      await tx.$executeRaw`INSERT INTO verification_reports(id,attempt_id,idempotency_record_id,attempt_revision,problem_revision_id,notation_profile,engine_version,scope,target_step_id,step_version_ids,dispatch_status,deadline_at)
        VALUES(${id}::uuid,${a.id}::uuid,${recordId}::uuid,${a.revision},${a.problem_revision_id}::uuid,${a.notation_profile},${ENGINE},${body.scope},${body.targetStepId}::uuid,${allVersionIds}::uuid[],'running',${deadline})`;
      return {
        snapshot: {
          id,
          recordId,
          context: {
            attemptId: a.id,
            attemptRevision: Number(a.revision),
            problemRevisionId: a.problem_revision_id,
            notationProfile: a.notation_profile,
            domain: "reals",
          },
          scope: body.scope,
          targetStepId: canonicalTarget,
          allVersionIds,
          steps,
          originalRaw: p.original_equation_raw,
          keyHash,
          deadline,
        },
      };
    });
  }
  private async compute(s: Snapshot, signal: AbortSignal): Promise<Computed> {
    const parses = new Map<string, ParseResult>();
    const original = await this.math.parse(
      s.context,
      { kind: "problem", stepVersionId: null },
      s.originalRaw,
      signal,
    );
    if (original.parseStatus === "service_error") throw unavailable();
    for (const step of s.steps) {
      const parsed = await this.math.parse(
        s.context,
        { kind: "step", stepVersionId: step.version_id },
        step.source_raw,
        signal,
      );
      if (parsed.parseStatus === "service_error") throw unavailable();
      parses.set(step.version_id, parsed);
    }
    const transitions: TransitionResult[] = [];
    const start =
      s.scope === "target_edge" && s.steps[0]?.id !== s.targetStepId ? 1 : 0;
    for (let i = start; i < s.steps.length; i++) {
      const to = s.steps[i]!,
        from = i > 0 ? s.steps[i - 1] : null;
      const verdict = await this.math.verify(
        s.context,
        {
          fromKind: from ? "step" : "problem",
          fromStepVersionId: from?.version_id ?? null,
          toStepVersionId: to.version_id,
          fromRaw: from?.source_raw ?? s.originalRaw,
          toRaw: to.source_raw,
        },
        signal,
      );
      if (verdict.status === "service_error") throw unavailable();
      const parsedFrom = from ? parses.get(from.version_id)! : original,
        parsedTo = parses.get(to.version_id)!;
      if (
        ["verified_valid", "verified_invalid"].includes(verdict.status) &&
        (parsedFrom.parseStatus !== "parsed" ||
          parsedTo.parseStatus !== "parsed")
      )
        throw unavailable();
      transitions.push(verdict);
    }
    let final: FinalResult | null = null;
    let completion: Schema<"Completion"> = {
      state: "unknown",
      canMarkAttemptCompleted: false,
      explanationAr: "فحص انتقال واحد لا يثبت اكتمال سلسلة الحل.",
    };
    if (s.scope === "current_sequence") {
      if (transitions.every((t) => t.status === "verified_valid")) {
        const last = s.steps.at(-1)!;
        final = await this.math.checkFinal(
          s.context,
          s.originalRaw,
          { stepVersionId: last.version_id, raw: last.source_raw },
          signal,
        );
        if (final.status === "service_error") throw unavailable();
        const complete =
          final.status === "verified_valid" &&
          final.isIsolated === true &&
          final.substitutionValid === true &&
          final.originalSolution?.kind === "singleton" &&
          final.finalSolution?.kind === "singleton";
        completion = {
          state: complete
            ? "verified_complete"
            : final.status === "inconclusive"
              ? "unknown"
              : "not_complete",
          canMarkAttemptCompleted: complete,
          explanationAr: complete
            ? "اكتملت سلسلة الحل رياضيًا وتحققت النهاية في المسألة الأصلية."
            : "الانتقالات متكافئة، لكن لم تثبت بعد نهاية معزولة متحققة للمسألة.",
        };
      } else {
        const abstained = transitions.some((t) =>
          ["syntax_error", "unsupported", "inconclusive"].includes(t.status),
        );
        completion = {
          state: abstained ? "unknown" : "not_complete",
          canMarkAttemptCompleted: false,
          explanationAr: abstained
            ? "لم يمكن تأكيد السلسلة كاملة. هذه الحالة ليست حكمًا على فهمك."
            : "تحتاج السلسلة إلى مراجعة انتقال قبل اعتماد اكتمال الحل.",
        };
      }
    }
    return { original, parses, transitions, final, completion };
  }
  private async commit(
    auth: GuestAuth,
    s: Snapshot,
    c: Computed,
  ): Promise<{ report: Schema<"VerificationReport">; revision: number }> {
    return this.store.db.$transaction(
      async (tx) => {
        await this.store.authorizeInTransaction(tx, auth);
        const a = await this.store.readAttemptInTransaction(
          tx,
          auth,
          s.context.attemptId,
        );
        const [job] = await tx.$queryRaw<
          { id: string }[]
        >`SELECT v.id FROM verification_reports v JOIN idempotency_records i ON i.id=v.idempotency_record_id WHERE v.id=${s.id}::uuid AND v.dispatch_status='running' AND v.deadline_at>now() AND i.state='processing' AND i.response_cache->>'runningReportId'=${s.id} FOR UPDATE OF v,i`;
        if (!job) throw unavailable();
        if (ph08Active()) await requireAssignmentCurrent(tx, a.id);
        const currentSteps = await this.store.readStepsInTransaction(tx, a.id);
        const current =
          Number(a.revision) === s.context.attemptRevision &&
          a.problem_revision_id === s.context.problemRevisionId &&
          a.notation_profile === s.context.notationProfile &&
          currentSteps.map((v) => v.version_id).join() ===
            s.allVersionIds.join();
        for (const [version, parsed] of c.parses) {
          await tx.$executeRaw`INSERT INTO parse_results(id,step_version_id,engine_version,notation_profile_version,parse_status,normalized_text,display_text,ast,reason_code,issue_span)
          VALUES(${randomUUID()}::uuid,${version}::uuid,${parsed.engineVersion},${parsed.notationProfileVersion},${parsed.parseStatus},${parsed.normalizedText},${parsed.displayAr},${parsed.ast ? JSON.stringify(parsed.ast) : null}::jsonb,${parsed.reasonCode},${parsed.issue ? JSON.stringify(parsed.issue) : null}::jsonb)`;
        }
        const verdicts: Schema<"TransitionVerdict">[] = [];
        const start =
          s.scope === "target_edge" && s.steps[0]?.id !== s.targetStepId
            ? 1
            : 0;
        for (const [index, result] of c.transitions.entries()) {
          const stepIndex = start + index,
            to = s.steps[stepIndex]!,
            from = stepIndex > 0 ? s.steps[stepIndex - 1] : null;
          const runId = randomUUID(),
            resultId = randomUUID();
          await tx.$executeRaw`INSERT INTO verification_runs(id,attempt_id,request_key_hash,attempt_revision_requested,problem_revision_id,from_kind,from_step_version_id,to_step_version_id,notation_profile_version,engine_version_requested,dispatch_status,finished_at,report_id)
          VALUES(${runId}::uuid,${a.id}::uuid,${s.keyHash},${BigInt(s.context.attemptRevision)},${s.context.problemRevisionId}::uuid,${from ? "step" : "problem"},${from?.version_id ?? null}::uuid,${to.version_id}::uuid,${s.context.notationProfile},${ENGINE},'finished',now(),${s.id}::uuid)`;
          await tx.$executeRaw`INSERT INTO verification_results(id,verification_run_id,math_status,reason_code,evidence_kind,evidence_json,engine_version_actual,schema_version,notation_profile_version,validated_at)
          VALUES(${resultId}::uuid,${runId}::uuid,${result.status},${result.reasonCode},${result.evidence?.type ?? null},${result.evidence ? JSON.stringify(result.evidence) : null}::jsonb,${result.engineVersion},${result.schemaVersion},${result.notationProfileVersion},now())`;
          verdicts.push({
            verificationResultId: resultId,
            from: {
              kind: from ? "step" : "problem",
              stepId: from?.id ?? null,
              stepVersion: from?.current_version ?? null,
            },
            to: { stepId: to.id, stepVersion: to.current_version },
            mathStatus: result.status,
            reasonCode: result.reasonCode,
            issue: result.issue,
            evidence: result.evidence
              ? {
                  kind: result.evidence.type,
                  domain: result.evidence.domain,
                  previousSolution: result.evidence.previousSolution,
                  nextSolution: result.evidence.nextSolution,
                  witness: result.evidence.witness,
                  summaryAr: null,
                }
              : null,
            engineVersion: result.engineVersion,
            notationProfileVersion: result.notationProfileVersion,
          });
        }
        const blocking = verdicts.findIndex(
          (v) => v.mathStatus !== "verified_valid",
        );
        const diagnosis =
          current &&
          s.scope === "current_sequence" &&
          blocking >= 0 &&
          this.diagnosis
            ? await this.diagnosis.persist(
                tx,
                a,
                verdicts,
                blocking === 0
                  ? c.original.ast
                  : c.parses.get(s.steps[blocking - 1]!.version_id)!.ast,
                c.parses.get(s.steps[blocking]!.version_id)!.ast,
              )
            : null;
        const report = output("VerificationReport", {
          id: s.id,
          attemptId: a.id,
          attemptRevision: s.context.attemptRevision,
          problemRevisionId: s.context.problemRevisionId,
          scope: s.scope,
          isCurrent: current,
          transitions: verdicts,
          firstBlockingTransitionIndex: blocking < 0 ? null : blocking,
          completion: current
            ? c.completion
            : {
                state: "unknown",
                canMarkAttemptCompleted: false,
                explanationAr:
                  "هذه نتيجة تاريخية لإصدار سابق؛ أعد فحص النسخة الحالية.",
              },
          diagnosisCandidate: diagnosis,
        });
        const serialized = JSON.stringify(report);
        if (Buffer.byteLength(serialized) > 60000) throw unavailable();
        await tx.$executeRaw`UPDATE verification_reports SET dispatch_status='finished',report_json=${serialized}::jsonb,final_result_json=${c.final ? JSON.stringify(c.final) : null}::jsonb,finished_at=now() WHERE id=${s.id}::uuid`;
        await tx.$executeRaw`UPDATE idempotency_records SET state='completed',response_code=${current ? 200 : 409},response_cache=${serialized}::jsonb WHERE id=${s.recordId}::uuid`;
        if (current && s.scope === "current_sequence") {
          const complete = c.completion.canMarkAttemptCompleted;
          await tx.$executeRaw`UPDATE attempts SET completion_verdict=${c.completion.state},status=${complete ? (hasAssistance(a) ? "assisted_completed" : "completed") : "in_progress"},closed_at=${complete ? new Date() : null},updated_at=now() WHERE id=${a.id}::uuid`;
          await recordLearningEvidence(tx, a, report);
        }
        return {
          report: publicMathReport(a.attempt_kind, report),
          revision: Number(a.revision),
        };
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }
  async verify(
    auth: GuestAuth,
    attemptId: string,
    key: string,
    body: Schema<"VerifyInput">,
  ): Promise<Schema<"VerificationReport">> {
    const prepared = await this.prepare(auth, attemptId, key, body);
    if ("cached" in prepared) return prepared.cached;
    const s = prepared.snapshot,
      controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.max(1, s.deadline.getTime() - Date.now()),
    );
    try {
      const result = await this.compute(s, controller.signal);
      if (controller.signal.aborted) throw unavailable();
      const committed = await this.commit(auth, s, result);
      if (!committed.report.isCurrent) throw conflict(committed.revision);
      return committed.report;
    } catch (error) {
      // A finished historical report is retained. Only this job's reservation
      // may be failed; an expired worker cannot overwrite a newer retry.
      await this.store.db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE verification_reports SET dispatch_status='failed',finished_at=now() WHERE id=${s.id}::uuid AND dispatch_status='running'`;
        await tx.$executeRaw`UPDATE idempotency_records SET state='failed',response_cache=NULL,response_code=NULL WHERE id=${s.recordId}::uuid AND state='processing' AND response_cache->>'runningReportId'=${s.id}`;
      });
      if (error instanceof ApiFault) throw error;
      throw unavailable();
    } finally {
      clearTimeout(timer);
    }
  }
  async detail(
    auth: GuestAuth,
    attemptId: string,
    resultId: string,
  ): Promise<Schema<"VerificationResultDetail">> {
    return this.store.db.$transaction(async (tx) => {
      await this.store.authorizeInTransaction(tx, auth);
      const a = await this.store.readAttemptInTransaction(tx, auth, attemptId);
      if (ph08Active()) await requireAssignmentCurrent(tx, a.id);
      const [row] = await tx.$queryRaw<
        { report_json: unknown; current: boolean }[]
      >`SELECT p.report_json,EXISTS(SELECT 1 FROM current_verification_runs c WHERE c.id=r.id) AS current FROM verification_results v JOIN verification_runs r ON r.id=v.verification_run_id JOIN verification_reports p ON p.id=r.report_id WHERE v.id=${resultId}::uuid AND r.attempt_id=${a.id}::uuid AND p.dispatch_status='finished' AND r.engine_version_requested=${ENGINE}`;
      if (!row) throw new ApiFault(404, "not_found", "المورد غير متاح.");
      const report = publicMathReport(
          a.attempt_kind,
          output("VerificationReport", row.report_json),
        ),
        result = report.transitions.find(
          (v) => v.verificationResultId === resultId.toLowerCase(),
        );
      if (!result)
        throw new ApiFault(500, "internal_error", "تعذر قراءة النتيجة.");
      return {
        attemptId: a.id,
        attemptRevision: report.attemptRevision,
        isCurrent:
          row.current &&
          report.isCurrent &&
          Number(a.revision) === report.attemptRevision,
        result,
      };
    });
  }
}
