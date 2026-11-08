import type {
  StemLabBlock,
  StemLabActivity,
} from "../../../../packages/contracts/src/stem-labs";
import type { SubjectCode } from "../../../../packages/contracts/src/product";
import { only, record, productInvalid, textField } from "../product-core";
import { skillCodes } from "../learning-path-payload";
import { validateMathLabSpec, publicMathActivity } from "./math-lab";
import {
  validatePhysicsLabSpec,
  type PhysicsSimulationSpec,
} from "./physics-inquiry";
import { validateCodingActivity, publicCodingActivity } from "./coding-lab";
import { parsePayload } from "../content-payload";
import type { PhysicsContent } from "../../../../packages/contracts/src/product";
import { physicsExposureKey } from "../physics-learning";

export const LAB_SCHEMA = "subject-lab-v1" as const;
export const LAB_POLICY = "stem-lab-learning-only-v1";
export const PHYSICS_LAB_KINDS = [
  "physics_prediction_experiment_v1",
  "physics_parameter_simulation_v1",
  "physics_graph_to_physics_v1",
  "physics_units_v1",
  "physics_misconception_contrast_v1",
];
export interface PhysicsLabActivitySpec {
  kind: string;
  model: PhysicsSimulationSpec;
  predictionPromptAr: string;
  observationPromptAr: string;
  explanationPromptAr: string;
  assumptionsAr: string[];
  controlledVariables: string[];
  privateValidation?: { reference: PhysicsContent };
}
export function parsePhysicsActivity(raw: unknown): PhysicsLabActivitySpec {
  const p = record(raw);
  only(p, [
    "kind",
    "model",
    "predictionPromptAr",
    "observationPromptAr",
    "explanationPromptAr",
    "assumptionsAr",
    "controlledVariables",
    "privateValidation",
  ]);
  if (!PHYSICS_LAB_KINDS.includes(String(p.kind)))
    throw productInvalid("نموذج مختبر الفيزياء غير مدعوم.");
  const texts = (value: unknown) => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 8)
      throw productInvalid();
    return value.map((s) => textField(s, 500));
  };
  const result: PhysicsLabActivitySpec = {
    kind: String(p.kind),
    model: validatePhysicsLabSpec(p.model),
    predictionPromptAr: textField(p.predictionPromptAr, 1000),
    observationPromptAr: textField(p.observationPromptAr, 1000),
    explanationPromptAr: textField(p.explanationPromptAr, 1000),
    assumptionsAr: texts(p.assumptionsAr),
    controlledVariables: texts(p.controlledVariables),
  };
  if (p.privateValidation !== undefined) {
    const v = record(p.privateValidation);
    only(v, ["reference"]);
    const payload = parsePayload({
      titleAr: "مرجع تجربة",
      statementAr: "قيمة ووحدة",
      subject: "physics",
      unitCode: "kinematics",
      unitTitleAr: "الحركة",
      lessonCode: "lab",
      lessonTitleAr: "مختبر",
      skillCodes: ["PHYS-CONSTANT_MOTION"],
      difficulty: 1,
      kind: "main",
      familyCode: "lab",
      hints: [],
      physics: v.reference,
    });
    if (!payload.physics) throw productInvalid();
    // Reference identity must match the displayed model; domain correctness is
    // still checked by PhysicsGateway at author validation and submission.
    const ref = payload.physics,
      parameters = result.model.parameters;
    const candidates =
      result.model.modelCode === "constant_velocity_1d"
        ? [
            {
              formula: "constant_velocity_displacement" as const,
              quantity: "displacement" as const,
              givens: {
                v: String(parameters.v_mps),
                t: String(parameters.t_s),
              },
            },
            {
              formula: "constant_speed_distance" as const,
              quantity: "distance" as const,
              givens: {
                v: String(Math.abs(parameters.v_mps!)),
                t: String(parameters.t_s),
              },
            },
          ]
        : [
            {
              formula: "displacement" as const,
              quantity: "displacement" as const,
              givens: {
                v0: String(parameters.v0_mps),
                a: String(parameters.a_mps2),
                t: String(parameters.t_s),
              },
            },
            {
              formula: "final_velocity" as const,
              quantity: "velocity" as const,
              givens: {
                v0: String(parameters.v0_mps),
                a: String(parameters.a_mps2),
                t: String(parameters.t_s),
              },
            },
          ];
    if (
      !candidates.some(
        (candidate) =>
          physicsExposureKey({ physics: candidate }) ===
          physicsExposureKey({ physics: ref }),
      )
    )
      throw productInvalid(
        "مرجع القيمة والوحدة لا يطابق نموذج التجربة ومعطياته.",
      );
    result.privateValidation = { reference: payload.physics };
  }
  return result;
}
export function labFeature(subject: SubjectCode) {
  return subject === "algebra"
    ? "MATH_LAB_ENABLED"
    : subject === "physics"
      ? "PHYSICS_LAB_ENABLED"
      : "CODING_LAB_NONEXEC_ENABLED";
}
/** Structural and resource gates, never a scientific review signature. */
export function parseLabBlock(
  raw: unknown,
  subject: SubjectCode,
): StemLabBlock & { domainSpec: Record<string, unknown> } {
  const b = record(raw);
  only(b, [
    "schemaVersion",
    "subject",
    "labKind",
    "objectiveAr",
    "familyCode",
    "skillCodes",
    "domainSpec",
  ]);
  if (b.schemaVersion !== LAB_SCHEMA || b.subject !== subject)
    throw productInvalid("المختبر لا يطابق مادة الدرس.");
  const familyCode = textField(b.familyCode, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(familyCode)) throw productInvalid();
  try {
    const spec =
      subject === "algebra"
        ? validateMathLabSpec(b.domainSpec)
        : subject === "physics"
          ? parsePhysicsActivity(b.domainSpec)
          : validateCodingActivity(b.domainSpec);
    if (spec.kind !== b.labKind)
      throw productInvalid("نوع المختبر لا يطابق مواصفته.");
    const skills = skillCodes(b.skillCodes, subject);
    if (!skills.length) throw productInvalid();
    return {
      schemaVersion: LAB_SCHEMA,
      subject,
      labKind: spec.kind,
      objectiveAr: textField(b.objectiveAr, 1000),
      familyCode,
      skillCodes: skills,
      domainSpec: spec as unknown as Record<string, unknown>,
    };
  } catch (e) {
    if (e && typeof e === "object" && "status" in e) throw e;
    throw productInvalid("مواصفة المختبر غير مدعومة أو تتجاوز حدودها.");
  }
}
export function publicLabActivity(
  raw: StemLabBlock,
  lessonId: string,
  blockIndex: number,
): StemLabActivity {
  const lab = parseLabBlock(raw, raw.subject);
  const domainSpec =
    lab.subject === "algebra"
      ? publicMathActivity(validateMathLabSpec(lab.domainSpec))
      : lab.subject === "programming"
        ? publicCodingActivity(lab.domainSpec)
        : (() => {
            const { privateValidation: _, ...visible } = parsePhysicsActivity(
              lab.domainSpec,
            );
            void _;
            return {
              ...visible,
              ...(_
                ? {
                    allowedUnits: ["m", "s", "m/s", "m/s²", "km/h"],
                    quantity: _.reference.quantity,
                  }
                : {}),
            };
          })();
  return {
    ...lab,
    activityRevisionId: lessonId,
    blockIndex,
    domainSpec: domainSpec as unknown as Record<string, unknown>,
  };
}
/** Conservative exposure extraction from a pinned authored spec, no grading. */
export function labMathSources(lab?: StemLabBlock): string[] {
  if (!lab || lab.subject !== "algebra" || !lab.domainSpec) return [];
  const s = lab.domainSpec;
  const result = [s.originalRaw, s.fromRaw, s.toRaw];
  for (const key of ["steps", "visibleSteps"])
    if (Array.isArray(s[key])) result.push(...s[key]);
  if (Array.isArray(s.methods))
    for (const m of s.methods) {
      const method = record(m);
      if (Array.isArray(method.steps)) result.push(...method.steps);
    }
  if (s.privateValidation && typeof s.privateValidation === "object") {
    const p = record(s.privateValidation);
    if (typeof p.completionRaw === "string") result.push(p.completionRaw);
    if (Array.isArray(p.workedSteps)) result.push(...p.workedSteps);
  }
  return result.filter((v): v is string => typeof v === "string");
}
