/** Read-only source/data audit. Does not import the app or invoke any service. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
import ts from "typescript";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const files = (directory, extension) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(directory, entry.name), extension)
      : entry.name.endsWith(extension)
        ? [resolve(directory, entry.name)]
        : [],
  );
const short = (path) => relative(root, path).replaceAll("\\", "/");
function splitSql(text) {
  let depth = 0,
    quote = false,
    start = 0;
  const result = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'") {
      if (quote && text[i + 1] === "'") {
        i++;
        continue;
      }
      quote = !quote;
    }
    if (quote) continue;
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) {
      result.push(text.slice(start, i));
      start = i + 1;
    }
  }
  result.push(text.slice(start));
  return result;
}
const tables = new Map();
for (const file of files(
  resolve(root, "apps/api/prisma/migrations"),
  ".sql",
).sort()) {
  const sql = readFileSync(file, "utf8");
  for (const found of sql.matchAll(
    /\bCREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?([a-z_]\w*)\s*\(/gi,
  )) {
    const start = found.index + found[0].length;
    let depth = 1,
      quote = false,
      end = start;
    for (; end < sql.length; end++) {
      const c = sql[end];
      if (c === "'") {
        if (quote && sql[end + 1] === "'") {
          end++;
          continue;
        }
        quote = !quote;
      }
      if (quote) continue;
      if (c === "(") depth++;
      if (c === ")" && --depth === 0) break;
    }
    const columns = new Set(
      splitSql(sql.slice(start, end))
        .map((part) =>
          part
            .trim()
            .match(/^([a-z_]\w*)/i)?.[1]
            ?.toLowerCase(),
        )
        .filter(
          (name) =>
            name &&
            ![
              "primary",
              "foreign",
              "unique",
              "check",
              "constraint",
              "exclude",
            ].includes(name),
        ),
    );
    tables.set(found[1].toLowerCase(), columns);
  }
  for (const found of sql.matchAll(
    /\bALTER TABLE\s+(?:public\.)?([a-z_]\w*)\s+ADD\s+(?:COLUMN\s+)?([a-z_]\w*)/gi,
  )) {
    if (
      !["constraint", "primary", "foreign", "unique", "check"].includes(
        found[2].toLowerCase(),
      )
    )
      tables.get(found[1].toLowerCase())?.add(found[2].toLowerCase());
  }
}
const sqlIssues = [];
let sqlTemplates = 0,
  insertStatements = 0,
  updateStatements = 0;
const routes = [];
const methods = {
  Get: "get",
  Post: "post",
  Put: "put",
  Delete: "delete",
  Patch: "patch",
};
const productControllers = new Set([
  "AccountsController",
  "BetaController",
  "ContentStudioController",
  "PhysicsController",
  "ProgrammingController",
]);
const registeredControllers = new Set();
for (const file of files(resolve(root, "apps/api/src"), ".ts")) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const location = (node) => ({
    file: short(file),
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
  });
  const decorators = (node) =>
    ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
  const calls = (node) =>
    decorators(node)
      .map((d) => d.expression)
      .filter(ts.isCallExpression);
  const visit = (node) => {
    if (ts.isClassDeclaration(node))
      for (const call of calls(node))
        if (
          call.expression.getText(source) === "Module" &&
          call.arguments[0] &&
          ts.isObjectLiteralExpression(call.arguments[0])
        ) {
          const controllers = call.arguments[0].properties.find(
            (property) =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(source) === "controllers",
          );
          if (
            controllers &&
            ts.isArrayLiteralExpression(controllers.initializer)
          )
            for (const controller of controllers.initializer.elements)
              registeredControllers.add(controller.getText(source));
        }
    if (
      ts.isTaggedTemplateExpression(node) &&
      /\$(?:queryRaw|executeRaw)/.test(node.tag.getText(source))
    ) {
      const template = node.template;
      const sql = ts.isNoSubstitutionTemplateLiteral(template)
        ? template.text
        : template.head.text +
          template.templateSpans
            .map((span) => " __PARAM__ " + span.literal.text)
            .join("");
      sqlTemplates++;
      const inspect = (table, columns, kind) => {
        const known = tables.get(table.toLowerCase());
        if (!known) {
          sqlIssues.push({
            ...location(node),
            kind,
            table,
            issue: "table not found in migration declarations",
          });
          return;
        }
        for (const column of columns)
          if (!known.has(column.toLowerCase()))
            sqlIssues.push({
              ...location(node),
              kind,
              table,
              column,
              issue: "column not found in migration declarations",
            });
      };
      for (const found of sql.matchAll(
        /\bINSERT\s+INTO\s+(?:public\.)?([a-z_]\w*)\s*\(([^)]*)\)/gi,
      )) {
        insertStatements++;
        inspect(
          found[1],
          found[2]
            .split(",")
            .map((c) => c.trim())
            .filter((c) => /^[a-z_]\w*$/i.test(c)),
          "insert",
        );
      }
      for (const found of sql.matchAll(
        /\bUPDATE\s+(?:public\.)?([a-z_]\w*)\s+SET\s+([\s\S]*?)(?=\bWHERE\b|\bRETURNING\b|;|$)/gi,
      )) {
        updateStatements++;
        inspect(
          found[1],
          splitSql(found[2])
            .map((p) => p.trim().match(/^([a-z_]\w*)\s*=/i)?.[1])
            .filter(Boolean),
          "update",
        );
      }
    }
    if (
      ts.isClassDeclaration(node) &&
      node.name &&
      productControllers.has(node.name.text)
    ) {
      const controller = calls(node).find(
        (call) => call.expression.getText(source) === "Controller",
      );
      const base = controller?.arguments[0]?.text;
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const decorated = calls(member),
          route = decorated.find(
            (call) => methods[call.expression.getText(source)],
          );
        if (!route) continue;
        const method = methods[route.expression.getText(source)],
          path =
            "/" + [base, route.arguments[0]?.text].filter(Boolean).join("/");
        const status =
          decorated.find(
            (call) => call.expression.getText(source) === "HttpCode",
          )?.arguments[0]?.text ?? (method === "post" ? 201 : 200);
        routes.push({
          ...location(member),
          controller: node.name.text,
          method,
          path,
          status: Number(status),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const spec = parse(read("docs/12-API-CONTRACT.yaml"));
const normalize = (path) => path.replace(/\{[^}]+\}|:[^/]+/g, "{}");
const routeIssues = [];
for (const controller of productControllers)
  if (!registeredControllers.has(controller))
    routeIssues.push({
      controller,
      issue: "controller absent from Module controller declarations",
    });
for (const route of routes) {
  const path = Object.keys(spec.paths).find(
    (path) => normalize(path) === normalize(route.path),
  );
  const operation = spec.paths[path]?.[route.method];
  if (!operation)
    routeIssues.push({ ...route, issue: "undocumented controller operation" });
  else if (!operation.responses?.[route.status])
    routeIssues.push({
      ...route,
      issue: "Nest default/declared success status not documented",
    });
}
const compiler = new Ajv2020({ strict: false, allErrors: true });
addFormats(compiler);
compiler.addFormat("int32", { type: "number", validate: Number.isInteger });
const validate = compiler.compile({
  components: spec.components,
  $ref: "#/components/schemas/StudioContentPayload",
});
const content = [];
const contentIssues = [];
for (const filename of [
  "algebra-expansion.draft.v1.json",
  "physics-kinematics.draft.v1.json",
  "python-basics.draft.v1.json",
]) {
  const bank = JSON.parse(read("apps/api/data/" + filename)),
    lessons = new Map();
  for (const [index, item] of bank.entries()) {
    if (!validate(item))
      contentIssues.push({
        file: filename,
        index,
        issues: structuredClone(validate.errors),
      });
    const kinds = lessons.get(item.lessonCode) ?? {
      main: 0,
      remediation: 0,
      transfer: 0,
    };
    kinds[item.kind]++;
    lessons.set(item.lessonCode, kinds);
    if (
      [1, 2, 3, 4].some(
        (level) => !item.hints.some((hint) => hint.level === level),
      )
    )
      contentIssues.push({
        file: filename,
        index,
        issue: "missing H1…H4 field",
      });
    if (
      item.programming &&
      (!item.programming.tests.some((t) => t.hidden) ||
        !item.programming.tests.some((t) => !t.hidden))
    )
      contentIssues.push({
        file: filename,
        index,
        issue: "public/hidden case missing",
      });
  }
  content.push({
    file: filename,
    items: bank.length,
    subject: bank[0]?.subject,
    lessons: Object.fromEntries(lessons),
    allHintsDraft: bank.every((item) =>
      item.hints.every((h) => h.reviewed === false),
    ),
    privateReferencesPresent: bank.every((item) =>
      item.algebra
        ? !!item.algebra.answerRaw &&
          !!item.algebra.validStepRaw &&
          !!item.algebra.invalidStepRaw
        : item.physics
          ? !!item.physics.expectedValueSI &&
            !!item.physics.expectedUnit &&
            !!item.physics.givens
          : item.programming
            ? !!item.programming.referenceCode &&
              item.programming.tests.length > 0
            : false,
    ),
  });
}
const planFiles = files(resolve(root, "planning/roadmap"), ".md").filter(
  (file) => /V[12]\./.test(file),
);
const tasks = planFiles.flatMap((file) =>
  [
    ...readFileSync(file, "utf8").matchAll(/^### (DEV-\d{3})\s*[—-]\s*(.+)$/gm),
  ].map((match) => ({
    id: match[1],
    title: match[2].trim(),
    plan: short(file),
  })),
);
const baseline = [
  ...planFiles,
  "docs/14-GOLDEN-DATASET.md",
  "docs/14-GOLDEN-DATASET.cases.json",
].map((file) => ({
  file: short(resolve(root, file)),
  sha256: createHash("sha256")
    .update(readFileSync(resolve(root, file)))
    .digest("hex"),
}));
// Reconstruct text substitutions only. This never parses or executes SQL.
let retentionDefinition = read(
  "apps/api/prisma/migrations/0010_guest_retention/migration.sql",
);
const migration11 = read(
  "apps/api/prisma/migrations/0011_accounts/migration.sql",
);
const migration15 = read(
  "apps/api/prisma/migrations/0015_roadmap_retention/migration.sql",
);
const migration16 = read(
  "apps/api/prisma/migrations/0016_claimed_guest_retention/migration.sql",
);
for (const match of migration11.matchAll(
  /definition\s*:=\s*replace\(definition,\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)'\s*\)/g,
))
  retentionDefinition = retentionDefinition.replace(
    match[1].replaceAll("''", "'"),
    match[2].replaceAll("''", "'"),
  );
const ownerKeys = migration15.match(
  /replace\(definition,\s*'counts jsonb :=',\s*'([^']*)'\)/,
);
if (ownerKeys)
  retentionDefinition = retentionDefinition.replace(
    "counts jsonb :=",
    ownerKeys[1],
  );
const cleanup = migration15.match(/\$body\$([\s\S]*?)\$body\$/);
if (cleanup)
  retentionDefinition = retentionDefinition.replace(
    "DELETE FROM public.skill_evidence",
    cleanup[1],
  );
const previous = migration16
  .match(/previous_selection text := '((?:''|[^'])*)'/)?.[1]
  .replaceAll("''", "'");
const replacement = migration16.match(
  /\$selection\$([\s\S]*?)\$selection\$/,
)?.[1];
const retention = {
  baselineGuardMatched: !!previous && retentionDefinition.includes(previous),
  roadmapCleanupPreserved: retentionDefinition.includes(
    "DELETE FROM public.subject_attempts",
  ),
  canonicalSuspensionProtected:
    !!replacement &&
    /account_owner\.learning_guest_id=guest_sessions\.id[\s\S]*?status NOT IN \('deletion_requested','deleted'\)/.test(
      replacement,
    ),
  claimedProvenanceProtected:
    !!replacement && replacement.includes("public.guest_account_claims"),
  reportAndHintForeignKeysProtected:
    !!replacement &&
    replacement.includes("public.verification_reports") &&
    replacement.includes("public.hint_requests") &&
    replacement.match(/learning\.guest_session_id<>guest_sessions\.id/g)
      ?.length === 2,
  guestSevenDayPolicyUnchanged:
    retentionDefinition.includes("+interval '7 days'"),
  sqlExecuted: false,
  limitation:
    "Text reconstruction and source predicates only; PostgreSQL grammar, privileges, locking, FK behavior and purge execution remain untested.",
};
if (previous && replacement)
  retentionDefinition = retentionDefinition.replace(previous, replacement);
const retentionIssues = Object.entries(retention)
  .filter(
    ([key, value]) =>
      typeof value === "boolean" && key !== "sqlExecuted" && !value,
  )
  .map(([key]) => key);
const report = {
  mode: "static-only; no app imports, tests, services, database or provider calls",
  schemaTables: tables.size,
  sql: {
    templates: sqlTemplates,
    inserts: insertStatements,
    updates: updateStatements,
    issues: sqlIssues,
    limitation:
      "Checks explicit INSERT/UPDATE column names only; does not parse/execute PostgreSQL or prove SELECT semantics, transaction correctness, triggers or isolation.",
  },
  controllers: {
    registered: [...registeredControllers].sort(),
    operations: routes.length,
    routes,
    issues: routeIssues,
    limitation:
      "AST checks Module/controller declarations and OpenAPI success status only; not runtime integration.",
  },
  content: {
    banks: content,
    issues: contentIssues,
    limitation:
      "Validates stored field shapes and structural lesson coverage only; no math engine or sandbox execution, content approval or learning effectiveness inferred.",
  },
  originalTasks: tasks,
  retention: {
    ...retention,
    reconstructedDefinitionSha256: createHash("sha256")
      .update(retentionDefinition)
      .digest("hex"),
    issues: retentionIssues,
  },
  baseline,
};
writeFileSync(
  resolve(root, "qa-reports/DEV-CODE-COMPLETENESS-STATIC.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      tasks: tasks.length,
      tables: tables.size,
      sqlTemplates,
      inserts: insertStatements,
      updates: updateStatements,
      sqlIssues,
      productOperations: routes.length,
      routeIssues,
      contentItems: content.reduce((n, b) => n + b.items, 0),
      contentIssues,
      retentionIssues,
    },
    null,
    2,
  ),
);
if (
  sqlIssues.length ||
  routeIssues.length ||
  contentIssues.length ||
  retentionIssues.length
)
  process.exitCode = 1;
