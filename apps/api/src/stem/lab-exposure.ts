import type { Prisma } from "@prisma/client";
import type { StemLabBlock } from "../../../../packages/contracts/src/stem-labs";
import { physicsExposureKey } from "../physics-learning";
import { parsePhysicsActivity } from "./lab-registry";
import type { LessonPayload } from "../../../../packages/contracts/src/learning-paths";
import type { SubjectCode } from "../../../../packages/contracts/src/product";

export interface LabContextExposure {
  key: string;
  at: string;
}
/** Identity only. Scientific checking remains in the original domain verifier. */
export function physicsLabContextKeys(
  lab: StemLabBlock,
  parameters?: Record<string, number>,
): string[] {
  if (lab.subject !== "physics") return [];
  const spec = parsePhysicsActivity(lab.domainSpec),
    p = parameters ?? spec.model.parameters;
  const keys: string[] = [];
  const add = (
    formula:
      | "constant_speed_distance"
      | "constant_velocity_displacement"
      | "final_velocity"
      | "displacement",
    quantity: "distance" | "displacement" | "velocity",
    givens: Record<string, string>,
  ) =>
    keys.push(physicsExposureKey({ physics: { formula, quantity, givens } }));
  if (spec.model.modelCode === "constant_velocity_1d") {
    add("constant_velocity_displacement", "displacement", {
      v: String(p.v_mps),
      t: String(p.t_s),
    });
    add("constant_speed_distance", "distance", {
      v: String(Math.abs(p.v_mps!)),
      t: String(p.t_s),
    });
    // The existing physics verifier accepts a signed v for distance and uses
    // abs(v)*t. Both authored forms have already been exposed by this model.
    add("constant_speed_distance", "distance", {
      v: String(p.v_mps),
      t: String(p.t_s),
    });
  } else {
    const givens = {
      v0: String(p.v0_mps),
      a: String(p.a_mps2),
      t: String(p.t_s),
    };
    add("final_velocity", "velocity", givens);
    add("displacement", "displacement", givens);
  }
  if (spec.privateValidation)
    keys.push(
      physicsExposureKey({ physics: spec.privateValidation.reference }),
    );
  return [...new Set(keys)];
}
export function mergeLabExposures(
  old: LabContextExposure[],
  keys: string[],
  at = new Date().toISOString(),
): LabContextExposure[] {
  const seen = new Set(old.map((v) => v.key));
  return [
    ...old,
    ...keys.filter((k) => !seen.has(k)).map((key) => ({ key, at })),
  ];
}
export async function readLabExposures(
  tx: Prisma.TransactionClient,
  ownerKey: string,
  subject?: SubjectCode,
) {
  const sessions = await tx.$queryRaw<
    {
      family: string;
      subject: string;
      created_at: Date;
      contexts: LabContextExposure[];
      exposed_families: string[];
    }[]
  >`SELECT data->>'familyCode' AS family,data->>'subject' AS subject,created_at,COALESCE(data->'contextExposures','[]'::jsonb) AS contexts,COALESCE(data->'exposedFamilies','[]'::jsonb) AS exposed_families FROM intelligent_learning_records WHERE owner_key=${ownerKey} AND kind IN ('lab','problem_session','project_run')`;
  const viewed = await tx.$queryRaw<
    { payload: LessonPayload; exposed_at: Date }[]
  >`SELECT r.payload,min(e.created_at) AS exposed_at FROM learning_content_revisions r JOIN learning_lesson_events e ON e.lesson_revision_id=r.id WHERE e.owner_key=${ownerKey} AND r.payload->>'kind'='lesson' GROUP BY r.id,r.payload`;
  const exposures = [
    ...sessions.flatMap((s) =>
      [...new Set([s.family, ...(s.exposed_families ?? [])])].map((family) => ({
        ...s,
        family,
      })),
    ),
    ...viewed.flatMap((v) =>
      v.payload.contentBlocks.flatMap((b) =>
        b.lab
          ? [
              {
                family: b.lab.familyCode,
                subject: b.lab.subject,
                created_at: v.exposed_at,
                contexts: physicsLabContextKeys(b.lab).map((key) => ({
                  key,
                  at: v.exposed_at.toISOString(),
                })),
              },
            ]
          : b.activity
            ? [
                {
                  family: b.activity.familyCode,
                  subject: b.activity.subject,
                  created_at: v.exposed_at,
                  contexts: [],
                },
              ]
            : [],
      ),
    ),
  ];
  return subject
    ? exposures.filter((exposure) => exposure.subject === subject)
    : exposures;
}
