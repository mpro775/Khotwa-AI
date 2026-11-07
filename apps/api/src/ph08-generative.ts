import type { DraftResult, HintContext } from "./ai-tutor";

export const PH08_GENERATION_VERSION = "ph08-generative-draft-v2";
export const V11_GENERATION_VERSION = "tutoring-natural-v1.1-draft";
export interface GenerationProfile {
  skillCode: string;
  errorCode: string | null;
  diagnosisMode: "possible" | "unresolved";
  phase: "remediation" | "transfer";
  transferExited: boolean;
  languageVersion?: "v1.1-draft";
}
type Concept =
  | "balance"
  | "distribution"
  | "sign"
  | "calculation"
  | "inverse"
  | "like_terms";
type Level = HintContext["targetHintLevel"];
const concepts: Record<
  Concept,
  { h1: string; h2: string; h3: string; follow: string }
> = {
  balance: {
    h1: "طرفي المساواة",
    h2: "كيف تبقى المساواة متوازنة",
    h3: "العملية على كل طرف",
    follow: "قارن الطرفين بنفسك",
  },
  distribution: {
    h1: "الحدين داخل القوس",
    h2: "كيف يتأثر كل حد بالمعامل",
    h3: "أثر المعامل على حد واحد",
    follow: "راجع الحد الآخر بنفسك",
  },
  sign: {
    h1: "إشارة المعامل",
    h2: "كيف تتحدد إشارة حاصل الضرب",
    h3: "إشارات عوامل حد واحد",
    follow: "راجع الإشارة بنفسك",
  },
  calculation: {
    h1: "الحساب العددي",
    h2: "كيف تراجع الحساب العددي",
    h3: "جزء عددي واحد",
    follow: "تحقق من حسابك بنفسك",
  },
  inverse: {
    h1: "العملية المرتبطة بالمتغير",
    h2: "ما العملية العكسية",
    h3: "نوع العملية المرتبطة بالمتغير",
    follow: "اختر العملية العكسية بنفسك",
  },
  like_terms: {
    h1: "الحدود المتشابهة",
    h2: "أي الحدود متشابهة",
    h3: "حدين متشابهين",
    follow: "راجع تجميع الحدود بنفسك",
  },
};
function conceptFor(p: GenerationProfile): Concept | null {
  // All choices originate in the server assignment/template, never model tags.
  const supported = /^SK-ALG-0[1-7]$/.test(p.skillCode);
  if (
    !supported ||
    (p.errorCode !== null && !/^ERR-ALG-0[1-6]$/.test(p.errorCode))
  )
    return null;
  // Owner-approved temporary PH08 gate while the curriculum mapping is pending.
  // Never remap the diagnosis or let an unresolved flag bypass this combination.
  if (p.skillCode === "SK-ALG-06" && p.errorCode === "ERR-ALG-05") return null;
  if (p.diagnosisMode === "unresolved") return "balance";
  const expected: Record<string, string[]> = {
    "ERR-ALG-01": ["SK-ALG-04"],
    "ERR-ALG-02": ["SK-ALG-02", "SK-ALG-05"],
    "ERR-ALG-03": ["SK-ALG-01", "SK-ALG-05"],
    "ERR-ALG-04": ["SK-ALG-05", "SK-ALG-06"],
    "ERR-ALG-05": ["SK-ALG-02", "SK-ALG-03"],
    "ERR-ALG-06": ["SK-ALG-02", "SK-ALG-04"],
  };
  if (!p.errorCode || !expected[p.errorCode]?.includes(p.skillCode))
    return null;
  const byError: Record<string, Concept> = {
    "ERR-ALG-01": "distribution",
    "ERR-ALG-02": "balance",
    "ERR-ALG-03": "balance",
    "ERR-ALG-04": "inverse",
    "ERR-ALG-05": "calculation",
    "ERR-ALG-06": "sign",
  };
  return byError[p.errorCode] ?? null;
}
const introductions = ["", "خذ وقتك، ", "لنراجع بهدوء، ", "قبل أن تتابع، "];
const endings = [
  "",
  " يمكنك تدوين ملاحظتك قبل المتابعة.",
  " إن لم تتضح الفكرة، اطلب مراجعة إضافية.",
];
const starters: Record<Level, string[]> = {
  H1: ["تأمل", "راجع", "لاحظ", "تفحص"],
  H2: ["اسأل نفسك", "تساءل"],
  H3: ["ابدأ بمراجعة", "راجع"],
};
const naturalFocus: Record<Concept, Record<Level, string[]>> = {
  balance: {
    H1: ["ما يحدث على جانبي المساواة"],
    H2: ["لماذا نطبق العملية نفسها على الطرفين"],
    H3: ["أثر عملية واحدة على كلا الطرفين"],
  },
  distribution: {
    H1: ["المعامل وكل حد داخل القوس"],
    H2: ["لماذا يشمل الضرب كل حد داخل القوس"],
    H3: ["ضرب المعامل في أحد الحدين"],
  },
  sign: {
    H1: ["الإشارة المرافقة للمعامل"],
    H2: ["أثر إشارة كل عامل في حاصل الضرب"],
    H3: ["إشارة حاصل ضرب حد واحد"],
  },
  calculation: {
    H1: ["العملية العددية المكتوبة"],
    H2: ["كيف تتحقق من العملية العددية منفصلة"],
    H3: ["حساب جزء عددي واحد"],
  },
  inverse: {
    H1: ["العملية التي تربط العدد بالمتغير"],
    H2: ["كيف تلغي العملية باستعمال عكسها"],
    H3: ["اختيار عملية تلغي العملية المرتبطة بالمتغير"],
  },
  like_terms: {
    H1: ["الحدود التي تحمل المتغير نفسه"],
    H2: ["لماذا نجمع معاملات الحدود المتشابهة"],
    H3: ["معاملي حدين متشابهين"],
  },
};
export function generationRules(p: GenerationProfile, level: Level) {
  if (
    !["H1", "H2", "H3"].includes(level) ||
    !["possible", "unresolved"].includes(p.diagnosisMode) ||
    !["remediation", "transfer"].includes(p.phase)
  )
    return null;
  const concept = conceptFor(p);
  if (!concept || (p.phase === "transfer" && !p.transferExited)) return null;
  const c = concepts[concept];
  return {
    version:
      p.languageVersion === "v1.1-draft"
        ? V11_GENERATION_VERSION
        : PH08_GENERATION_VERSION,
    concept,
    level,
    diagnosisMode: p.diagnosisMode,
    // This describes a compositional language, not an enum of whole messages.
    grammar: {
      introductions:
        p.languageVersion === "v1.1-draft"
          ? [...introductions, "يمكننا المراجعة خطوة خطوة، "]
          : introductions,
      transferPrefix: p.phase === "transfer" ? "بعد العودة إلى التدريب، " : "",
      starters: starters[level],
      focus: level === "H1" ? c.h1 : level === "H2" ? c.h2 : c.h3,
      focusAlternatives:
        p.languageVersion === "v1.1-draft" ? naturalFocus[concept][level] : [],
      continuation:
        level === "H3" ? ["، ثم " + c.follow, "، وبعد ذلك " + c.follow] : [],
      punctuation: level === "H2" ? "؟" : ".",
      endings,
    },
  };
}
export const PH08_GENERATIVE_PROMPT =
  "أنت مساعد عربي في تجربة اصطناعية قيد المراجعة. صغ تلميحًا جديدًا من تراكيب اللغة التعليمية المحدودة المرفقة، مع مقدمة وخاتمة مختلفتين عن القالب. لا تختَر النص المحفوظ حرفيًا. المهارة والخطأ المحتمل والمستوى يحددها الخادم. لا تكتب معادلة أو عددًا أو ناتجًا أو جوابًا أو حكم صحة أو سببًا جازمًا للخطأ. لا تدّع اعتماد المحتوى أو ضعف المتعلم. لا تضف كلمات خارج التراكيب المسموح بها. عند غياب المعنى الكافي امتنع. أعد مخطط JSON فقط؛ إقرارك بعدم كشف الحل لا يمنح صلاحية العرض.";

/** Separate deterministic semantic parser. Every word, concept, speech act,
 * sequence and disclosure level must parse. Unknown prose fails closed; a mere
 * blacklist, shared keywords or a model safety declaration cannot authorize it.
 * This draft grammar is intentionally narrower than unrestricted Arabic.
 */
export function validateGeneratedMeaning(
  text: string,
  context: HintContext,
  p: GenerationProfile,
): DraftResult {
  const reject = (reason: string): DraftResult => ({ text: null, reason });
  if (p.phase === "transfer" && !p.transferExited)
    return reject("PH08_INDEPENDENT_TRANSFER");
  const rules = generationRules(p, context.targetHintLevel);
  if (!rules) return reject("PH08_UNSUPPORTED_PROFILE");
  if (
    [context.reviewedHintTextAr, ...context.approvedRephrasesAr].includes(text)
  )
    return reject("PH08_LITERAL_TEMPLATE");
  if (text.length > 360 || !/^[\u0621-\u063a\u0641-\u064a ،.؟]+$/u.test(text))
    return reject("PH08_SYMBOL_OR_UNVERIFIED_MATH");
  let body = text;
  if (body.startsWith("بعد العودة إلى التدريب، ")) {
    if (p.phase !== "transfer") return reject("PH08_PHASE_MISMATCH");
    body = body.slice("بعد العودة إلى التدريب، ".length);
  }
  const intro = rules.grammar.introductions.find(
    (v) => v && body.startsWith(v),
  );
  if (intro) body = body.slice(intro.length);
  const ending = endings.find((v) => v && body.endsWith(v));
  if (ending) body = body.slice(0, -ending.length);
  const g = rules.grammar;
  if (!body.endsWith(g.punctuation)) return reject("PH08_UNPARSED_MEANING");
  body = body.slice(0, -g.punctuation.length);
  const starter = g.starters.find((v) => body.startsWith(v + " "));
  if (!starter) return reject("PH08_LEVEL_OR_SPEECH_ACT");
  body = body.slice(starter.length + 1);
  if (context.targetHintLevel === "H3") {
    const continuation = g.continuation.find((v) => body.endsWith(v));
    if (!continuation) return reject("PH08_LEVEL_OR_SPEECH_ACT");
    body = body.slice(0, -continuation.length);
  }
  if (![g.focus, ...g.focusAlternatives].includes(body))
    return reject("PH08_SKILL_OR_UNPARSED_MEANING");
  return { text, reason: "PH08_GENERATED_VALIDATED" };
}
