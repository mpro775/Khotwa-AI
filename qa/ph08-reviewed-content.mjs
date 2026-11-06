import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const {
  reviewedCards,
  reviewedTemplateVersion,
} = require("../apps/api/dist/ph08-reviewed-content.js");

/** Append only. The executable entry point is deliberately test-DB-only. */
export async function installReviewedContent(pool, fixtures) {
  const url = new URL(process.env.DATABASE_URL);
  const isolatedTest =
    /^khotwa-ph08-[a-f0-9]{12}-db$/.test(url.hostname) &&
    url.pathname === "/ph08_test";
  const ownerAuthorizedDemo =
    process.env.MVP_CLOSURE_DEMO === "true" &&
    /^khotwa-ph09-[a-f0-9]{12}-db$/.test(url.hostname) &&
    url.pathname === "/ph09_test";
  if (!isolatedTest && !ownerAuthorizedDemo)
    throw Error("PH08_ISOLATED_SYNTHETIC_DATABASE_REQUIRED");
  const cards = reviewedCards(process.env.PH08_REVIEWED_CONTENT_PATH);
  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query("BEGIN");
    if (ownerAuthorizedDemo) {
      const release = await client.query(
        "SELECT id FROM content_releases WHERE id=$1 AND release_code LIKE 'ph09-test-%'",
        [fixtures.releaseId],
      );
      if (release.rowCount !== 1)
        throw Error("SYNTHETIC_DEMO_RELEASE_REQUIRED");
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      fixtures.releaseId,
    ]);
    const targets = (
      await client.query(
        "SELECT r.id,s.skill_code FROM problem_revisions r JOIN problem_skills p ON p.problem_revision_id=r.id JOIN skills s ON s.id=p.skill_id WHERE r.release_id=$1 AND r.item_kind IN ('remediation','transfer')",
        [fixtures.releaseId],
      )
    ).rows;
    for (const card of cards) {
      if (card.operationalStatus === "approved_unpublished_fraction_blocked")
        continue;
      // The 21 logical originals plus 3 mapping originals are preserved disabled;
      // enabled copies bind the exact same bytes to a PH08 skill/problem version.
      const bound = targets.filter(
        (x) => card.errorCode === null || x.skill_code === card.skillCode,
      );
      for (const target of [null, ...bound.map((x) => x.id)]) {
        const version = reviewedTemplateVersion(card);
        const old = (
          await client.query(
            "SELECT id,text_ar FROM intervention_templates WHERE release_id=$1 AND template_version=$2 AND problem_revision_id IS NOT DISTINCT FROM $3::uuid",
            [fixtures.releaseId, version, target],
          )
        ).rows;
        if (old.length) {
          if (old.length !== 1 || old[0].text_ar !== card.textAr)
            throw Error("PH08_EXISTING_VERSION_MISMATCH");
          continue;
        }
        const id = randomUUID();
        await client.query(
          "INSERT INTO intervention_templates(id,release_id,problem_revision_id,error_code,hint_level,template_version,policy_version,text_ar,allowed_rephrases,math_assertions,solution_steps,is_synthetic,enabled,review_status,reviewed_by_role,reviewed_at) VALUES($1,$2,$3,$4,$5,$6,'tutoring-p0-0.7.0',$7,'[]','[]','[]',true,$8,'reviewed','PRODUCT_OWNER_ATTESTATION_OF_REVIEWER_APPROVAL',now())",
          [
            id,
            fixtures.releaseId,
            target,
            card.errorCode,
            Number(card.hintLevel.slice(1)),
            version,
            card.textAr,
            target !== null,
          ],
        );
        const metadata = {
          approvalReference:
            "planning/approvals/PH08-CONTENT-OWNER-ATTESTATION-2026-11-06.md",
          approvalStatus: "APPROVED_BY_OWNER_ATTESTATION",
          cardId: card.id,
          contentSha256: card.contentSha256,
          reviewerSigned: false,
          reviewerReviewedAt: null,
          recordedDate: "2026-11-06",
          reviewedAtMeaning: "owner_attestation_recorded_at",
          scope: "synthetic_ph08_only",
          operationalStatus: card.operationalStatus,
        };
        await client.query(
          "INSERT INTO audit_events(id,correlation_id,entity_kind,entity_id,event_code,limited_metadata) VALUES($1,$2,'intervention_template',$3,'PH08_CONTENT_OWNER_ATTESTATION',$4::jsonb)",
          [randomUUID(), randomUUID(), id, JSON.stringify(metadata)],
        );
        inserted.push({
          templateId: id,
          problemRevisionId: target,
          cardId: card.id,
          contentSha256: card.contentSha256,
          templateVersion: version,
          enabled: target !== null,
        });
      }
    }
    await client.query("COMMIT");
    return inserted;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
