import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import pg from "pg";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { stemLabsJourney } from "../../../qa/stem-labs-journey.mjs";
const require = createRequire(import.meta.url);
test(
  "B synthetic actual NestJS PostgreSQL SymPy journey",
  { skip: process.env.B_INTEGRATION !== "true", timeout: 120000 },
  async (t) => {
    const database = new URL(process.env.DATABASE_URL);
    assert.equal(database.hostname, "127.0.0.1");
    assert.equal(database.pathname, "/b_test");
    assert.match(process.env.B_TEST_CONTAINER, /^khotwa-b-[a-f0-9]{12}-db$/);
    assert.equal(process.env.KHOTWA_SYNTHETIC_DATA, "true");
    const pool = new pg.Pool({ connectionString: database.href });
    const { createApplication } = require("../dist/application.js"),
      { Store } = require("../dist/store.js");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    t.after(async () => {
      await app.close();
      await pool.end();
    });
    const base = await app.getUrl(),
      store = app.get(Store);
    const spec = parse(readFileSync("docs/12-API-CONTRACT.yaml", "utf8"));
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validators = new Map();
    function actor(initial = {}) {
      const jar = new Map(Object.entries(initial));
      return {
        csrf: null,
        cookieSnapshot: () => Object.fromEntries(jar),
        async request(path, method = "GET", body, options = {}) {
          const headers = {
            origin: process.env.PUBLIC_APP_ORIGIN,
            "sec-fetch-site": "same-origin",
          };
          if (jar.size)
            headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
          if (method !== "GET")
            Object.assign(headers, {
              "content-type": "application/json",
              "x-csrf-token": this.csrf ?? "",
              "idempotency-key": options.key ?? randomUUID(),
            });
          Object.assign(headers, options.headers ?? {});
          const response = await fetch(base + "/api/v1" + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
          });
          for (const cookie of response.headers.getSetCookie()) {
            const [key, value] = cookie.split(";")[0].split("=");
            if (value) jar.set(key, value);
            else jar.delete(key);
          }
          const raw = await response.text(),
            value = raw ? JSON.parse(raw) : null;
          assert.match(response.headers.get("cache-control"), /no-store/);
          const target = "/api/v1" + path.split("?")[0];
          const route = Object.entries(spec.paths).find(([template]) =>
            new RegExp(
              "^" + template.replace(/\{[^}]+\}/g, "[^/]+") + "$",
            ).test(target),
          );
          assert.ok(route, target);
          let schema =
            route[1][method.toLowerCase()]?.responses[String(response.status)];
          assert.ok(
            schema,
            `${method} ${target} undocumented status ${response.status}`,
          );
          if (schema.$ref)
            schema = schema.$ref
              .split("/")
              .slice(1)
              .reduce((n, k) => n[k], spec);
          schema = schema.content?.["application/json"]?.schema;
          if (schema) {
            const key = JSON.stringify(schema);
            if (!validators.has(key))
              validators.set(
                key,
                ajv.compile({ components: spec.components, ...schema }),
              );
            const validate = validators.get(key);
            assert.equal(
              validate(value),
              true,
              JSON.stringify(validate.errors),
            );
          }
          if (options.expect !== undefined)
            assert.equal(
              response.status,
              options.expect,
              JSON.stringify(value),
            );
          return { status: response.status, data: value?.data, value };
        },
        async start() {
          this.csrf = (
            await this.request("/bootstrap", "GET", undefined, { expect: 200 })
          ).data.csrfToken;
          this.csrf = (
            await this.request("/guest-sessions", "POST", {}, { expect: 201 })
          ).data.csrfToken;
        },
      };
    }
    const reviewerId = randomUUID(),
      token = randomBytes(32).toString("base64url");
    await pool.query(
      "INSERT INTO users(id,email_normalized,email_verified_at,role,status,is_internal) VALUES($1,$2,now(),'admin','active',true)",
      [reviewerId, "b-test-not-human-" + reviewerId + "@example.invalid"],
    );
    await pool.query(
      "INSERT INTO auth_sessions(id,user_id,token_digest,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [
        randomUUID(),
        reviewerId,
        Buffer.from(store.security.digest("account:" + token), "hex"),
      ],
    );
    const reviewer = actor({ kh_account: token });
    reviewer.csrf = store.security.guestCsrf(token);
    await stemLabsJourney({ t, pool, app, actor, reviewerId, reviewer });
  },
);
