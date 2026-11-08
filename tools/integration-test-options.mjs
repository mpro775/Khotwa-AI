import path from "node:path";

// Report names stay stable, while a new acceptance run can keep its evidence
// separate from the historical A/B/C delivery reports.
export function integrationReportPath(args, defaultFile) {
  const values = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--report-dir") values.push(args[++index]);
    else if (argument.startsWith("--report-dir="))
      values.push(argument.slice("--report-dir=".length));
  }
  if (values.length === 0) return defaultFile;
  if (
    values.length !== 1 ||
    typeof values[0] !== "string" ||
    !values[0].trim() ||
    values[0].startsWith("--")
  )
    throw new Error("Expected one nonempty --report-dir directory");
  return path.join(values[0], path.basename(defaultFile));
}

export function syntheticIntegrationEnvironment(inherited = process.env) {
  const environment = { ...inherited };
  const restricted = {
    AI_ENABLED: "false",
    BETA_ENABLED: "false",
    BETA_AI_ENABLED: "false",
    BETA_GEMINI_ENABLED: "false",
    PH08_GEMINI_GENERATIVE_ENABLED: "false",
    SOCRATIC_EXTERNAL_AI_ENABLED: "false",
    PROGRAMMING_RUNNER_ENABLED: "false",
    CODING_LAB_RUNNER_BRIDGE_ENABLED: "false",
    PHET_INTEGRATION_ENABLED: "false",
    REAL_LEARNING_ENABLED: "false",
    ACCOUNT_MAIL_MODE: "disabled",
    C_COHORT_ANALYTICS_ENABLED: "false",
    C_PROJECT_UPLOADS_ENABLED: "false",
  };
  // Credentials and external endpoints from a developer shell must not be
  // available to synthetic acceptance tests, even when flags are disabled.
  // Windows resolves environment keys case-insensitively. Remove all aliases
  // before inserting canonical flags, including in a plain child env object.
  for (const name of Object.keys(environment)) {
    const canonical = name.toUpperCase();
    if (
      /^(GEMINI_|GOOGLE_|SMTP_|JUDGE0_|RUNNER_|BETA_GEMINI_)/.test(canonical) ||
      ["DATABASE_URL", "MATH_ENGINE_BASE_URL"].includes(canonical) ||
      Object.hasOwn(restricted, canonical)
    )
      delete environment[name];
  }
  return { ...environment, ...restricted };
}

export function cleanupTestContainers(created, command) {
  // Validate the complete list before issuing any removal, and never mutate
  // the list used to describe resources created by this invocation.
  for (const name of created)
    if (!/^khotwa-(?:v22|b|c)-[a-f0-9]{12}-(?:db|math)$/.test(name))
      throw new Error("Refusing cleanup of an unscoped container");
  return [...created].reverse().map((name) => ({
    name,
    exitCode: command("docker", ["rm", "-f", name]).exitCode,
  }));
}
