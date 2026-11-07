import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
/** Reuse only explicitly reviewed, enabled catalog/probe snapshots for the
 * exact existing curriculum skill. No new misconception or approval is made. */
export async function materializeStudioDiagnosis(
  tx: Prisma.TransactionClient,
  releaseId: string,
  skillId: string,
  skillCode: string,
): Promise<void> {
  const [source] = await tx.$queryRaw<
    { id: string }[]
  >`SELECT c.id FROM content_releases c WHERE c.status='published' AND c.release_code NOT LIKE 'studio-%' AND EXISTS(SELECT 1 FROM misconception_catalog m JOIN skills s ON s.id=m.skill_id WHERE m.release_id=c.id AND s.skill_code=${skillCode} AND m.enabled AND m.is_synthetic AND m.review_status='reviewed' AND m.reviewed_at IS NOT NULL AND m.reviewed_by_role IS NOT NULL) ORDER BY c.published_at DESC,c.id LIMIT 1 FOR SHARE OF c`;
  if (!source) return;
  const catalogs = await tx.$queryRaw<
    {
      error_code: string;
      catalog_version: string;
      reviewed_by_role: string;
      reviewed_at: Date;
    }[]
  >`SELECT m.error_code,m.catalog_version,m.reviewed_by_role,m.reviewed_at FROM misconception_catalog m JOIN skills s ON s.id=m.skill_id WHERE m.release_id=${source.id}::uuid AND s.skill_code=${skillCode} AND m.enabled AND m.is_synthetic AND m.review_status='reviewed' AND m.reviewed_at IS NOT NULL AND m.reviewed_by_role IS NOT NULL FOR SHARE OF m,s`;
  for (const m of catalogs)
    await tx.$executeRaw`INSERT INTO misconception_catalog(id,release_id,error_code,skill_id,catalog_version,enabled,is_synthetic,review_status,reviewed_by_role,reviewed_at) VALUES(${randomUUID()}::uuid,${releaseId}::uuid,${m.error_code},${skillId}::uuid,${m.catalog_version},true,true,'reviewed',${m.reviewed_by_role},${m.reviewed_at})`;
  const templates = await tx.$queryRaw<
    {
      family: string;
      template_version: string;
      question_ar: string;
      options_json: unknown;
      rules_json: unknown;
      reviewed_by_role: string;
      reviewed_at: Date;
    }[]
  >`SELECT family,template_version,question_ar,options_json,rules_json,reviewed_by_role,reviewed_at FROM diagnostic_templates WHERE release_id=${source.id}::uuid AND enabled AND is_synthetic AND review_status='reviewed' AND reviewed_at IS NOT NULL AND reviewed_by_role IS NOT NULL FOR SHARE`;
  for (const t of templates)
    await tx.$executeRaw`INSERT INTO diagnostic_templates(id,release_id,family,template_version,question_ar,options_json,rules_json,enabled,is_synthetic,review_status,reviewed_by_role,reviewed_at) VALUES(${randomUUID()}::uuid,${releaseId}::uuid,${t.family},${t.template_version},${t.question_ar},${JSON.stringify(t.options_json)}::jsonb,${JSON.stringify(t.rules_json)}::jsonb,true,true,'reviewed',${t.reviewed_by_role},${t.reviewed_at})`;
  await tx.$executeRaw`INSERT INTO audit_events(id,correlation_id,entity_kind,entity_id,event_code,limited_metadata) VALUES(${randomUUID()}::uuid,${randomUUID()}::uuid,'content_release',${releaseId}::uuid,'studio.reviewed_catalog_snapshot',${JSON.stringify({ sourceReleaseId: source.id, skillCode, catalogCount: catalogs.length, probeTemplateCount: templates.length })}::jsonb)`;
}
