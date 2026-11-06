import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const spec = parse(
  readFileSync(
    new URL("../docs/12-API-CONTRACT.yaml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validators = new Map();
function check(schema, data) {
  const key = JSON.stringify(schema);
  let validator = validators.get(key);
  if (!validator) {
    validator = ajv.compile({ components: spec.components, ...schema });
    validators.set(key, validator);
  }
  assert.equal(validator(data), true, JSON.stringify(validator.errors));
}
const resolve = (s) =>
  s.$ref
    ? s.$ref
        .split("/")
        .slice(1)
        .reduce((o, k) => o[k], spec)
    : s;
export function createActor(
  base,
  contracts,
  origin = "https://localhost:8443",
) {
  const jar = new Map();
  let csrf;
  return {
    jar,
    async request(path, method = "GET", body, key = randomUUID(), extra = {}) {
      const headers = { origin, ...extra };
      if (jar.size)
        headers.cookie = [...jar].map(([k, v]) => k + "=" + v).join("; ");
      if (method !== "GET")
        Object.assign(headers, {
          "content-type": "application/json",
          "x-csrf-token": csrf ?? "",
          "idempotency-key": key,
        });
      const response = await fetch(base + "/api/v1" + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      for (const value of response.headers.getSetCookie()) {
        const [k, v] = value.split(";")[0].split("=");
        if (v) jar.set(k, v);
        else jar.delete(k);
      }
      const text = await response.text(),
        value = text ? JSON.parse(text) : null;
      assert.match(response.headers.get("cache-control"), /no-store/);
      if (value)
        assert.equal(
          value.meta.requestId,
          response.headers.get("x-request-id"),
        );
      const full = "/api/v1" + path.split("?")[0];
      let matched = false;
      for (const [template, methods] of Object.entries(spec.paths)) {
        if (
          !new RegExp("^" + template.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
            full,
          )
        )
          continue;
        const operation = methods[method.toLowerCase()];
        assert.ok(operation);
        const responseSpec = operation.responses[response.status];
        assert.ok(responseSpec, `${method} ${template}: ${response.status}`);
        const schema =
          resolve(responseSpec).content?.["application/json"]?.schema;
        if (schema) check(schema, value);
        else assert.equal(text, "");
        contracts.push({
          operationId: operation.operationId,
          status: response.status,
        });
        matched = true;
        break;
      }
      assert.equal(matched, true);
      return {
        status: response.status,
        body: value,
        text,
        headers: response.headers,
      };
    },
    async start() {
      const bootstrap = await this.request("/bootstrap");
      assert.equal(bootstrap.status, 200);
      csrf = bootstrap.body.data.csrfToken;
      const created = await this.request("/guest-sessions", "POST", {});
      assert.equal(created.status, 201);
      csrf = created.body.data.csrfToken;
      const learning = await this.request("/learning-sessions", "POST", {});
      assert.equal(learning.status, 201);
      assert.equal(learning.body.data.isSynthetic, true);
      return learning.body.data;
    },
  };
}
