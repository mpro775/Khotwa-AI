import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import pg from "pg";
import { seedIntegration } from "./ph09-fixtures.mjs";
import { installReviewedContent } from "./ph08-reviewed-content.mjs";
const url = new URL(process.env.DATABASE_URL);
if (
  !/^khotwa-ph09-[a-f0-9]{12}-db$/.test(url.hostname) ||
  url.pathname !== "/ph09_test" ||
  process.env.MVP_CLOSURE_DEMO !== "true"
)
  throw Error("ISOLATED_SYNTHETIC_DEMO_REQUIRED");
const r = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    "apps/api/prisma.config.ts",
  ],
  { encoding: "utf8" },
);
if (r.status !== 0) throw Error("MVP_LOCAL_MIGRATION_FAILED");
const pool = new pg.Pool({ connectionString: url.href });
try {
  let release = (
    await pool.query(
      "SELECT id FROM content_releases WHERE release_code LIKE 'ph09-test-%' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0];
  if (!release) release = { id: (await seedIntegration(pool)).releaseId };
  const installed = await installReviewedContent(pool, {
    releaseId: release.id,
  });
  // Fraction presentation is not accepted; remove these pairings from this demo.
  await pool.query(
    "UPDATE content_pairings p SET enabled=false FROM problem_revisions r,problem_revisions t WHERE p.remediation_revision_id=r.id AND p.transfer_revision_id=t.id AND (r.original_equation_raw ~ '[/÷]' OR t.original_equation_raw ~ '[/÷]')",
  );
  for (const [role, key] of [
    ["mvp_api", "MVP_API_PASSWORD"],
    ["mvp_maintenance", "MVP_RETENTION_PASSWORD"],
  ]) {
    const password = process.env[key];
    if (!/^[a-f0-9]{64}$/.test(password ?? ""))
      throw Error("DEMO_ROLE_SECRET_REQUIRED");
    const exists = (
      await pool.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])
    ).rowCount;
    await pool.query(
      `${exists ? "ALTER" : "CREATE"} ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
    );
  }
  await pool.query(
    "GRANT USAGE ON SCHEMA public TO mvp_api; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO mvp_api; REVOKE ALL ON FUNCTION purge_expired_guests(boolean,integer) FROM mvp_api; GRANT khotwa_retention_operator TO mvp_maintenance",
  );
  const rows = (
    await pool.query(
      "SELECT t.id,t.template_version,t.text_ar,t.review_status,t.reviewed_by_role,t.enabled,a.limited_metadata FROM intervention_templates t JOIN audit_events a ON a.entity_id=t.id AND a.event_code='PH08_CONTENT_OWNER_ATTESTATION' WHERE t.release_id=$1 ORDER BY t.template_version,t.id",
      [release.id],
    )
  ).rows;
  const require = createRequire(import.meta.url),
    {
      reviewedCards,
      reviewedTemplateVersion,
    } = require("../apps/api/dist/ph08-reviewed-content.js");
  const cards = reviewedCards(process.env.PH08_REVIEWED_CONTENT_PATH);
  for (const row of rows) {
    const card = cards.find(
      (c) => reviewedTemplateVersion(c) === row.template_version,
    );
    if (
      !card ||
      card.textAr !== row.text_ar ||
      row.review_status !== "reviewed" ||
      row.limited_metadata.contentSha256 !== card.contentSha256 ||
      row.limited_metadata.reviewerSigned !== false
    )
      throw Error("DEMO_CONTENT_PROVENANCE_MISMATCH");
  }
  if (rows.length !== 249) throw Error("DEMO_CONTENT_COUNT_MISMATCH");
  if ((await installReviewedContent(pool, { releaseId: release.id })).length)
    throw Error("NON_IDEMPOTENT_CONTENT_INSTALL");
  writeFileSync(
    "/evidence/demo-content.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        database: "persistent local synthetic demo; not temporary test DB",
        reviewedRows: rows.length,
        insertedThisRun: installed.length,
        reviewerSource: "PRODUCT_OWNER_ATTESTATION_OF_REVIEWER_APPROVAL",
        reviewerSigned: false,
        manifestSha256: createHash("sha256")
          .update(readFileSync(process.env.PH08_REVIEWED_CONTENT_PATH))
          .digest("hex"),
        cards: cards.map((c) => ({
          id: c.id,
          sha256: c.contentSha256,
          operationalStatus: c.operationalStatus,
        })),
        fractionPairingsDisabled: true,
        problemBankReview: "pending; no approval inherited from the 27 cards",
        actualGeminiCalls: 0,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Persistent synthetic demo initialized; 249 reviewed content rows verified; bank review pending.",
  );
} finally {
  await pool.end();
}
