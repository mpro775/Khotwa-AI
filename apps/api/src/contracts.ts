import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020, { ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import type { components } from "@khotwa/contracts";
import { ApiFault } from "./http";

export type Schema<K extends keyof components["schemas"]> =
  components["schemas"][K];
const publicPath = resolve(
  __dirname,
  "../../../packages/contracts/openapi.yaml",
);
const internalPath = resolve(
  __dirname,
  "../../../packages/contracts/schemas/math-internal-v1.schema.json",
);
const publicSpec: unknown = parse(readFileSync(publicPath, "utf8"));
if (
  typeof publicSpec !== "object" ||
  publicSpec === null ||
  !("components" in publicSpec)
)
  throw new Error("Public contract missing");
const shared = publicSpec.components;
const internalSpec: unknown = JSON.parse(readFileSync(internalPath, "utf8"));
if (
  typeof internalSpec !== "object" ||
  internalSpec === null ||
  !("$defs" in internalSpec)
)
  throw new Error("Math contract missing");
const definitions = internalSpec.$defs;
const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
});
addFormats(ajv);
ajv.addFormat("int32", {
  type: "number",
  validate: (n: number) =>
    Number.isInteger(n) && n >= -2147483648 && n <= 2147483647,
});
const cache = new Map<string, ValidateFunction>();
function validator(name: string, internal = false): ValidateFunction {
  const key = (internal ? "internal:" : "public:") + name;
  let check = cache.get(key);
  if (!check) {
    check = ajv.compile(
      internal
        ? { $defs: definitions, $ref: "#/$defs/" + name }
        : { components: shared, $ref: "#/components/schemas/" + name },
    );
    cache.set(key, check);
  }
  return check;
}
export function input<K extends keyof components["schemas"]>(
  name: K,
  value: unknown,
): Schema<K> {
  const check = validator(name);
  if (!check(value))
    throw new ApiFault(
      422,
      "invalid_input",
      "الطلب لا يطابق الحقول والقيم المسموحة.",
      (check.errors ?? []).slice(0, 8).map((e) => ({
        path: "body" + e.instancePath.replaceAll("/", "."),
        rule: e.keyword,
        messageAr: "راجع هذا الحقل وفق صيغة الطلب.",
      })),
    );
  return value as Schema<K>;
}
export function internalValue<T>(name: string, value: unknown): T {
  if (!validator(name, true)(value))
    throw new ApiFault(
      503,
      "math_unavailable",
      "تعذر اعتماد استجابة محرك الرياضيات.",
    );
  return value as T;
}
export function uuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ApiFault(400, "invalid_input", "معرّف المورد غير صالح.");
  return value;
}
export function output<K extends keyof components["schemas"]>(
  name: K,
  value: unknown,
): Schema<K> {
  if (!validator(name)(value))
    throw new ApiFault(500, "internal_error", "تعذر اعتماد بيانات الاستجابة.");
  return value as Schema<K>;
}
export function idempotencyHeader(
  value: string | string[] | undefined,
): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value))
    throw new ApiFault(
      400,
      "invalid_input",
      "رأس Idempotency-Key مطلوب بصيغة صالحة.",
    );
  return value;
}
