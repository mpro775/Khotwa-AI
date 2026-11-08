import { createHash } from "node:crypto";

/** Original, bounded teaching models. These snapshots are learning activities,
 * never an assessment verdict; scalar answers still use PhysicsGateway. */
export interface PhysicsSimulationSpec {
  schemaVersion: "physics-lab-v1";
  modelCode: "constant_velocity_1d" | "constant_acceleration_1d";
  modelVersion: "1.0.0";
  parameters: {
    v_mps?: number;
    v0_mps?: number;
    a_mps2?: number;
    t_s: number;
    x0_m: number;
  };
  sampleCount?: number;
}
export interface PhysicsSimulationSnapshot {
  schemaVersion: "physics-lab-snapshot-v1";
  modelCode: PhysicsSimulationSpec["modelCode"];
  modelVersion: "1.0.0";
  unitSystem: "SI";
  assumptions: string[];
  points: { t_s: number; x_m: number; v_mps: number }[];
  displacement_m: number;
  distance_m: number;
  finalVelocity_mps: number;
  reversalTime_s: number | null;
  checksum: string;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_PHYSICS_MODEL");
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  if (
    required.some((key) => !(key in value)) ||
    Object.keys(value).some((key) => ![...required, ...optional].includes(key))
  )
    throw new Error("INVALID_PHYSICS_MODEL");
}
function bounded(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error("PHYSICS_PARAMETER_OUT_OF_RANGE");
  return value;
}
export function validatePhysicsLabSpec(raw: unknown): PhysicsSimulationSpec {
  const value = object(raw);
  keys(
    value,
    ["schemaVersion", "modelCode", "modelVersion", "parameters"],
    ["sampleCount"],
  );
  if (
    value.schemaVersion !== "physics-lab-v1" ||
    value.modelVersion !== "1.0.0" ||
    !["constant_velocity_1d", "constant_acceleration_1d"].includes(
      String(value.modelCode),
    )
  )
    throw new Error("UNSUPPORTED_PHYSICS_MODEL");
  const parameters = object(value.parameters);
  keys(
    parameters,
    value.modelCode === "constant_velocity_1d"
      ? ["v_mps", "t_s", "x0_m"]
      : ["v0_mps", "a_mps2", "t_s", "x0_m"],
  );
  bounded(parameters.t_s, 0, 3600);
  bounded(parameters.x0_m, -1_000_000, 1_000_000);
  if (value.modelCode === "constant_velocity_1d")
    bounded(parameters.v_mps, -10_000, 10_000);
  else {
    bounded(parameters.v0_mps, -10_000, 10_000);
    bounded(parameters.a_mps2, -100, 100);
  }
  if (
    value.sampleCount !== undefined &&
    (!Number.isInteger(value.sampleCount) ||
      bounded(value.sampleCount, 2, 501) !== value.sampleCount)
  )
    throw new Error("PHYSICS_SAMPLE_LIMIT");
  return structuredClone(value) as unknown as PhysicsSimulationSpec;
}

/** Unit conversion is explicit, not a free-form unit/expression parser. */
export function physicsQuantityToSI(value: number, unit: string) {
  bounded(value, -1_000_000_000, 1_000_000_000);
  const registry: Record<string, { dimension: string; factor: number }> = {
    m: { dimension: "length", factor: 1 },
    s: { dimension: "time", factor: 1 },
    "m/s": { dimension: "speed", factor: 1 },
    "m/s²": { dimension: "acceleration", factor: 1 },
    "m/s^2": { dimension: "acceleration", factor: 1 },
    "km/h": { dimension: "speed", factor: 5 / 18 },
  };
  const entry = Object.hasOwn(registry, unit) ? registry[unit] : undefined;
  if (!entry) throw new Error("UNSUPPORTED_PHYSICS_UNIT");
  return { valueSI: value * entry.factor, dimension: entry.dimension };
}

export function simulatePhysicsModel(raw: unknown): PhysicsSimulationSnapshot {
  const spec = validatePhysicsLabSpec(raw);
  const p = spec.parameters;
  const initialVelocity =
    spec.modelCode === "constant_velocity_1d" ? p.v_mps! : p.v0_mps!;
  const acceleration =
    spec.modelCode === "constant_velocity_1d" ? 0 : p.a_mps2!;
  const displacement = (time: number) =>
    initialVelocity * time + (acceleration * time * time) / 2;
  const turning = acceleration === 0 ? null : -initialVelocity / acceleration;
  const reversalTime_s =
    turning !== null && turning > 0 && turning < p.t_s ? turning : null;
  const displacement_m = displacement(p.t_s);
  const distance_m =
    reversalTime_s === null
      ? Math.abs(displacement_m)
      : Math.abs(displacement(reversalTime_s)) +
        Math.abs(displacement_m - displacement(reversalTime_s));
  const count = p.t_s === 0 ? 1 : (spec.sampleCount ?? 101);
  const points = Array.from({ length: count }, (_, index) => {
    const t_s = count === 1 ? 0 : (p.t_s * index) / (count - 1);
    return {
      t_s,
      x_m: p.x0_m + displacement(t_s),
      v_mps: initialVelocity + acceleration * t_s,
    };
  });
  const snapshot = {
    schemaVersion: "physics-lab-snapshot-v1" as const,
    modelCode: spec.modelCode,
    modelVersion: spec.modelVersion,
    unitSystem: "SI" as const,
    assumptions: [
      "one_dimension",
      spec.modelCode === "constant_velocity_1d"
        ? "constant_velocity"
        : "constant_acceleration",
      "positive_axis_explicit",
      "ideal_model_not_real_measurement",
      "distance_integrates_speed_across_reversal",
    ],
    points,
    displacement_m,
    distance_m,
    finalVelocity_mps: initialVelocity + acceleration * p.t_s,
    reversalTime_s,
  };
  return {
    ...snapshot,
    checksum: createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex"),
  };
}
