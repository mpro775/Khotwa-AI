import type { Prisma } from "@prisma/client";
import type { ProductOwner } from "./product-core";
import type { Store } from "./store";
import { buildHintContext, composeWithDeadline } from "./ai-tutor";
import { BetaGeminiPort, withProductAiOwner } from "./beta-gemini";
import { canDeliverExternalAi } from "./external-ai-access";
import { betaAiConfigured } from "./external-ai-access";
import { betaTelemetry } from "./beta-operations";
export interface SubjectHintInput {
  store: Store;
  owner: ProductOwner;
  subject: "physics" | "programming";
  level: 1 | 2 | 3;
  reviewedTextAr: string;
  skillCodes: string[];
  observationCode: string;
  previousHintLevel: number;
  signal?: AbortSignal;
}
export interface SubjectHintComposition {
  textAr: string;
  source: "reviewed_template" | "llm_validated";
  reasonCode: string;
}
const skillNames: Record<string, string> = {
  "PY-PRINT": "إخراج النص من البرنامج",
  "PY-VARIABLES": "المتغيرات",
  "PY-ARITHMETIC": "الحساب في البرنامج",
  "PY-CONDITIONS": "الشروط",
  "PY-LOOPS": "التكرار",
  "PY-FUNCTIONS": "الدوال",
  "PHYS-CONSTANT_MOTION": "الحركة المنتظمة",
  "PHYS-DISTANCE_DISPLACEMENT": "المسافة والإزاحة",
  "PHYS-AVERAGE_SPEED": "السرعة المتوسطة",
  "PHYS-ACCELERATION": "التسارع",
  "PHYS-FINAL_VELOCITY": "السرعة النهائية",
  "PHYS-DISPLACEMENT": "الإزاحة",
};
export function subjectObservation(
  subject: "physics" | "programming",
  code: string,
): string | null {
  const labels: Record<string, string> =
    subject === "programming"
      ? {
          compile_error:
            "أفاد متحقق البرمجة بوجود خطأ في صياغة الكود؛ لا نستنتج ضعفًا مفاهيميًا.",
          runtime_error:
            "توقف تنفيذ البرنامج بخطأ؛ سبب الخطأ المفاهيمي غير مؤكد.",
          timeout:
            "انتهت مهلة تنفيذ البرنامج؛ راجع التكرار وحدود العمل دون استنتاج حكم على المتعلم.",
          tests_not_passed:
            "اكتمل التشغيل ولم تجتز كل الحالات؛ يبقى الحكم لمتحقق البرمجة.",
          tests_passed:
            "اجتاز البرنامج الحالات المطلوبة؛ هذه قرينة محدودة وليست إتقانًا دائمًا.",
        }
      : {
          wrong_value:
            "أفاد المتحقق بأن القيمة العددية تحتاج مراجعة والوحدة مناسبة؛ السبب غير مؤكد.",
          wrong_unit:
            "أفاد المتحقق بأن الوحدة تحتاج مراجعة؛ لا نستنتج سببًا مفاهيميًا مؤكدًا.",
          correct:
            "ثبتت صحة القيمة والوحدة ضمن دقة المسألة؛ هذه قرينة محدودة وليست إتقانًا دائمًا.",
        };
  return Object.hasOwn(labels, code) ? labels[code]! : null;
}
/** Only reviewed hint text and fixed subject labels enter the provider context.
 * Raw code, answers, tests, ownership identifiers and history never enter it. */
export async function composeSubjectHint(
  input: SubjectHintInput,
): Promise<SubjectHintComposition> {
  const fallback = (reasonCode: string): SubjectHintComposition => ({
    textAr: input.reviewedTextAr,
    source: "reviewed_template",
    reasonCode,
  });
  const withoutInvocation = (reasonCode: string): SubjectHintComposition => {
    betaTelemetry.recordAi({
      provider: "not_used",
      invoked: false,
      source: "reviewed_template",
      inputTokens: null,
      outputTokens: null,
      estimatedCostMicros: null,
    });
    return fallback(reasonCode);
  };
  const observation = subjectObservation(input.subject, input.observationCode);
  if (!observation) return withoutInvocation("UNASSESSABLE_OBSERVATION");
  const allowed = await input.store.db.$transaction((tx) =>
    canDeliverExternalAi(tx, input.owner),
  );
  if (!allowed) return withoutInvocation("BETA_AI_DISABLED_OR_UNCONSENTED");
  let port: BetaGeminiPort;
  try {
    port = new BetaGeminiPort(input.store);
  } catch {
    return withoutInvocation("BETA_AI_CONFIGURATION_INVALID");
  }
  const context = buildHintContext({
    level: input.level,
    templateId: `reviewed-${input.subject}-H${input.level}`,
    contentVersion: "subject-reviewed-v1",
    textAr: input.reviewedTextAr,
    variants: [],
    skillNameAr:
      input.skillCodes
        .map((code) =>
          Object.hasOwn(skillNames, code) ? skillNames[code] : null,
        )
        .filter((name): name is string => name !== null)
        .slice(0, 3)
        .join("، ") ||
      (input.subject === "physics"
        ? "التفكير في الكميات والوحدات الفيزيائية"
        : "التفكير في خطوات البرنامج"),
    observationAr: observation,
    maxOutputTokens: 256,
    recentActions: {
      previousHintLevel: input.previousHintLevel,
      verifiedErrorObservations: 0,
    },
  });
  const timeoutMs = Number(process.env.BETA_GEMINI_TIMEOUT_MS ?? 8000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000)
    return withoutInvocation("BETA_AI_CONFIGURATION_INVALID");
  const result = await withProductAiOwner(
    input.store,
    input.owner,
    async () => {
      const draft = await composeWithDeadline(
        port,
        context,
        input.signal ?? new AbortController().signal,
        timeoutMs,
        256,
      );
      const invoked = port.invocationStarted();
      betaTelemetry.recordAi({
        provider: invoked ? "gemini" : "not_used",
        model: port.model,
        invoked,
        source: draft.text === null ? "reviewed_template" : "llm_validated",
        inputTokens: draft.inputTokens ?? null,
        outputTokens: draft.outputTokens ?? null,
        billingOutputTokens: draft.billingOutputTokens,
        estimatedCostMicros: null,
        timeout: draft.reason === "AI_TIMEOUT",
      });
      return draft;
    },
  );
  if (result.text === null) return fallback(result.reason);
  // Recheck withdrawal, session revocation, authorization expiry and access pause
  // after network completion; consumed usage was already metered above.
  if (
    !port.enabled ||
    !(await input.store.db.$transaction((tx) =>
      canDeliverExternalAi(tx, input.owner),
    ))
  )
    return fallback("BETA_AI_DELIVERY_NOT_AUTHORIZED");
  return {
    textAr: result.text,
    source: "llm_validated",
    reasonCode: result.reason,
  };
}
export async function canDeliverSubjectAi(
  tx: Prisma.TransactionClient,
  owner: ProductOwner,
): Promise<boolean> {
  return (
    process.env.BETA_GEMINI_OUTPUT_CAP_POLICY === "total_generation" &&
    betaAiConfigured() &&
    canDeliverExternalAi(tx, owner)
  );
}
