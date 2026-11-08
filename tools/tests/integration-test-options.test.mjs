import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  cleanupTestContainers,
  integrationReportPath,
  syntheticIntegrationEnvironment,
} from "../integration-test-options.mjs";

test("report directory keeps D0 evidence separate and retains legacy defaults", () => {
  const legacy = "qa-reports/C-ADVANCED-LEARNING/C-INTEGRATION.json";
  assert.equal(integrationReportPath([], legacy), legacy);
  for (const args of [
    ["--report-dir", "qa-reports/D0-evidence"],
    ["--report-dir=qa-reports/D0-evidence"],
  ])
    assert.equal(
      integrationReportPath(args, legacy),
      path.join("qa-reports/D0-evidence", "C-INTEGRATION.json"),
    );
});

test("invalid or repeated report options fail before starting infrastructure", () => {
  for (const args of [
    ["--report-dir"],
    ["--report-dir="],
    ["--report-dir", "  "],
    ["--report-dir", "--serve"],
    ["--report-dir", "first", "--report-dir=second"],
  ])
    assert.throws(() => integrationReportPath(args, "report.json"));
});

test("synthetic tests cannot inherit external credentials or enable services", () => {
  const inherited = {
    PATH: "test-path",
    DATABASE_URL: "postgresql://existing.invalid/real",
    MATH_ENGINE_BASE_URL: "https://existing.invalid",
    GEMINI_API_KEY: "secret",
    GOOGLE_API_KEY: "secret",
    SMTP_PASSWORD: "secret",
    JUDGE0_AUTH_TOKEN: "secret",
    BETA_GEMINI_AUTHORIZATION_ID: "external-approval",
    AI_ENABLED: "true",
    REAL_LEARNING_ENABLED: "true",
    PHET_INTEGRATION_ENABLED: "true",
    PROGRAMMING_RUNNER_ENABLED: "true",
    ACCOUNT_MAIL_MODE: "smtp",
  };
  const environment = syntheticIntegrationEnvironment(inherited);
  assert.equal(environment.PATH, "test-path");
  for (const name of [
    "DATABASE_URL",
    "MATH_ENGINE_BASE_URL",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "SMTP_PASSWORD",
    "JUDGE0_AUTH_TOKEN",
    "BETA_GEMINI_AUTHORIZATION_ID",
  ])
    assert.equal(Object.hasOwn(environment, name), false, name);
  for (const name of [
    "AI_ENABLED",
    "BETA_ENABLED",
    "BETA_AI_ENABLED",
    "BETA_GEMINI_ENABLED",
    "PH08_GEMINI_GENERATIVE_ENABLED",
    "SOCRATIC_EXTERNAL_AI_ENABLED",
    "PROGRAMMING_RUNNER_ENABLED",
    "CODING_LAB_RUNNER_BRIDGE_ENABLED",
    "PHET_INTEGRATION_ENABLED",
    "REAL_LEARNING_ENABLED",
    "C_COHORT_ANALYTICS_ENABLED",
    "C_PROJECT_UPLOADS_ENABLED",
  ])
    assert.equal(environment[name], "false", name);
  assert.equal(environment.ACCOUNT_MAIL_MODE, "disabled");
  assert.equal(inherited.AI_ENABLED, "true");
  assert.equal(inherited.GEMINI_API_KEY, "secret");
});

test("cleanup only removes scoped resources and records failures truthfully", () => {
  const created = ["khotwa-c-123456abcdef-db", "khotwa-c-123456abcdef-math"];
  const calls = [];
  const result = cleanupTestContainers(created, (executable, args) => {
    calls.push({ executable, args });
    return { exitCode: args.at(-1).endsWith("math") ? 1 : 0 };
  });
  assert.deepEqual(result, [
    { name: created[1], exitCode: 1 },
    { name: created[0], exitCode: 0 },
  ]);
  assert.deepEqual(calls, [
    { executable: "docker", args: ["rm", "-f", created[1]] },
    { executable: "docker", args: ["rm", "-f", created[0]] },
  ]);
  assert.deepEqual(created, [
    "khotwa-c-123456abcdef-db",
    "khotwa-c-123456abcdef-math",
  ]);
  let removed = false;
  assert.throws(() =>
    cleanupTestContainers([created[0], "existing-user-database"], () => {
      removed = true;
      return { exitCode: 0 };
    }),
  );
  assert.equal(removed, false);
});

test("mixed-case credentials and flag aliases stay absent in a child process", () => {
  const environment = syntheticIntegrationEnvironment({
    gemini_api_key: "DUMMY_NOT_A_REAL_KEY",
    SmTp_PassWord: "DUMMY_NOT_A_REAL_KEY",
    Database_Url: "postgresql://existing.invalid/real",
    Ai_Enabled: "true",
    ReAl_LeArNiNg_EnAbLeD: "true",
    Account_Mail_Mode: "smtp",
  });
  for (const alias of [
    "gemini_api_key",
    "SmTp_PassWord",
    "Database_Url",
    "Ai_Enabled",
    "ReAl_LeArNiNg_EnAbLeD",
    "Account_Mail_Mode",
  ])
    assert.equal(Object.hasOwn(environment, alias), false, alias);
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      "console.log(JSON.stringify({gemini: Boolean(process.env.GEMINI_API_KEY), smtp: Boolean(process.env.SMTP_PASSWORD), database: Boolean(process.env.DATABASE_URL), ai: process.env.AI_ENABLED, real: process.env.REAL_LEARNING_ENABLED, mail: process.env.ACCOUNT_MAIL_MODE}))",
    ],
    { env: environment, encoding: "utf8", timeout: 10000, windowsHide: true },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    gemini: false,
    smtp: false,
    database: false,
    ai: "false",
    real: "false",
    mail: "disabled",
  });
});
