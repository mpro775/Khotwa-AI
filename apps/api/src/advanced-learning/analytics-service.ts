import { createHash, randomUUID } from "node:crypto";
import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import type {
  CAnalyticsDashboard,
  CContentAnalytics,
} from "../../../../packages/contracts/src/advanced-learning";
import type { AReview } from "../../../../packages/contracts/src/intelligent-learning";
import { Store } from "../store";
import { AccountService } from "../accounts";
import { LearningAssessmentService } from "../learning-assessments";
import { LearningPathContentService } from "../learning-path-content";
import { ARecords, aRead, requireAFeature } from "../intelligent-learning-data";
import { ApiFault, type RequestContext } from "../http";
import { uuid } from "../contracts";
import { only, productEnvelope, productInvalid } from "../product-core";
import {
  C_METRIC_VERSION,
  normalizeCEvents,
  projectCMetrics,
  type CActivityObservation,
} from "./analytics-projection";

export class CAnalyticsService {
  constructor(
    readonly store: Store,
    readonly accounts: AccountService,
    readonly assessments: LearningAssessmentService,
    readonly content: LearningPathContentService,
  ) {}
  async me(
    request: RequestContext,
    query: Record<string, unknown>,
  ): Promise<CAnalyticsDashboard> {
    requireAFeature("C_LEARNING_ANALYTICS_ENABLED");
    only(query, ["trackRevisionId", "window"]);
    if (
      typeof query.trackRevisionId !== "string" ||
      (query.window !== undefined &&
        (typeof query.window !== "string" ||
          !["7", "14", "30"].includes(query.window)))
    )
      throw productInvalid();
    const trackId = uuid(query.trackRevisionId),
      days = Number(query.window ?? 7),
      owner = await this.accounts.actor(request),
      auth = await this.store.authenticate(request);
    if (!auth)
      throw new ApiFault(401, "unauthenticated", "ابدأ جلسة للمتابعة.");
    return aRead(this.store, owner, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.ownerKey},0))`;
      const c = await this.assessments.context(request, trackId, {
        tx,
        owner,
        auth,
      });
      const records = new ARecords(tx, owner.ownerKey),
        reviews = (await records.list<AReview>("review", trackId)).map(
          (r) => r.data,
        ),
        activityRows = await tx.$queryRaw<
          {
            id: string;
            revision: number;
            kind: CActivityObservation["kind"];
            subject: string;
            status: string;
            updated_at: Date;
            completed_at: Date | null;
          }[]
        >`SELECT r.id,r.revision,r.kind,r.data->>'subject' AS subject,r.data->>'status' AS status,r.updated_at,(SELECT min(e.created_at) FROM intelligent_learning_events e WHERE e.record_id=r.id AND e.owner_key=r.owner_key AND e.data->>'status'='completed') AS completed_at FROM intelligent_learning_records r WHERE r.owner_key=${owner.ownerKey} AND r.track_revision_id=${trackId}::uuid AND r.kind IN ('problem_session','project_run') ORDER BY r.id`;
      const now = new Date(),
        from = new Date(now.getTime() - days * 86400000),
        events = normalizeCEvents(
          c.observations,
          c.track.payload.subject,
          reviews,
          activityRows.map((r) => ({
            id: r.id,
            revision: r.revision,
            kind: r.kind,
            subject: r.subject,
            completed: r.status === "completed",
            at: (r.completed_at ?? r.updated_at).toISOString(),
          })),
        ),
        fingerprint = createHash("sha256")
          .update(JSON.stringify(events))
          .digest("hex");
      const [cursor] = await tx.$queryRaw<
        { source_fingerprint: string }[]
      >`SELECT source_fingerprint FROM learning_analytics_projection_cursor WHERE owner_key=${owner.ownerKey} AND track_revision_id=${trackId}::uuid AND metric_version=${C_METRIC_VERSION}`;
      if (cursor?.source_fingerprint !== fingerprint) {
        // Reconciliation with a durable canonical snapshot handles late arrivals,
        // tombstones and revised/assisted verdicts without permanent double count.
        await tx.$executeRaw`DELETE FROM learning_analytics_events WHERE owner_key=${owner.ownerKey} AND track_revision_id=${trackId}::uuid`;
        for (const e of events)
          await tx.$executeRaw`INSERT INTO learning_analytics_events(id,owner_key,track_revision_id,source_table,source_id,source_revision,event_type,event_version,occurred_at,payload) VALUES(${randomUUID()}::uuid,${owner.ownerKey},${trackId}::uuid,${e.sourceTable},${e.sourceId},${e.sourceRevision},${e.eventType},${e.eventVersion},${new Date(e.occurredAt)},${JSON.stringify(e)}::jsonb)`;
        await tx.$executeRaw`INSERT INTO learning_analytics_projection_cursor(owner_key,track_revision_id,metric_version,source_fingerprint) VALUES(${owner.ownerKey},${trackId}::uuid,${C_METRIC_VERSION},${fingerprint}) ON CONFLICT(owner_key,track_revision_id,metric_version) DO UPDATE SET source_fingerprint=EXCLUDED.source_fingerprint,projected_at=now()`;
      }
      const windowEvents = events.filter(
          (e) =>
            Date.parse(e.occurredAt) >= from.getTime() &&
            Date.parse(e.occurredAt) <= now.getTime(),
        ),
        projected = projectCMetrics(windowEvents);
      const [submissions] = await tx.$queryRaw<
        { n: number }[]
      >`SELECT count(*)::int AS n FROM learning_project_submissions s JOIN intelligent_learning_records r ON r.id=s.project_run_id WHERE r.owner_key=${owner.ownerKey} AND r.track_revision_id=${trackId}::uuid AND s.created_at>=${from} AND s.created_at<=${now}`;
      const dashboard: CAnalyticsDashboard = {
        schemaVersion: "learning-metrics-v1",
        metricVersion: C_METRIC_VERSION,
        trackRevisionId: trackId,
        generatedAt: now.toISOString(),
        window: { from: from.toISOString(), to: now.toISOString(), days },
        synthetic: true,
        metrics: projected.metrics,
        activity: {
          ...projected.activity,
          projectSubmitted: submissions?.n ?? 0,
        },
        provenance: [
          "canonical_a2_context",
          "verification_reports",
          "subject_attempts",
          "intelligent_learning_records",
        ],
        missingCount: projected.missingCount,
        notesAr: [
          "بيانات اصطناعية؛ اكتمال النشاط أو المشروع لا يمنح إتقانًا مستقلًا.",
          "المقامات تخص أحدث مسائل متميزة وفق A2؛ التعطل التقني مستبعد.",
          "المقارنة السببية ومعايرة rubric وتغطية البنك تنتظر مراجعة متخصصة.",
        ],
      };
      await tx.$executeRaw`INSERT INTO learning_metrics_snapshots(owner_key,track_revision_id,metric_version,window_days,data) VALUES(${owner.ownerKey},${trackId}::uuid,${C_METRIC_VERSION},${days},${JSON.stringify(dashboard)}::jsonb) ON CONFLICT(owner_key,track_revision_id,metric_version,window_days) DO UPDATE SET data=EXCLUDED.data,generated_at=now()`;
      return dashboard;
    });
  }
  async contentQuality(
    request: RequestContext,
    query: Record<string, unknown>,
  ): Promise<CContentAnalytics> {
    requireAFeature("C_LEARNING_ANALYTICS_ENABLED");
    only(query, ["revisionId"]);
    if (typeof query.revisionId !== "string") throw productInvalid();
    const id = uuid(query.revisionId),
      owner = await this.accounts.actor(request, false, ["admin"]);
    return aRead(this.store, owner, async (tx) => {
      await this.accounts.authorizeInTransaction(tx, owner);
      const row = await this.content.row(id, tx),
        blocks = row.payload.kind === "lesson" ? row.payload.contentBlocks : [];
      return {
        schemaVersion: "learning-metrics-v1",
        revisionId: id,
        synthetic: true,
        status: "suppressed",
        reasonCode: "privacy_threshold_pending",
        metrics: [],
        quality: {
          problemActivities: blocks.filter((b) => b.type === "problem_activity")
            .length,
          projectActivities: blocks.filter((b) => b.type === "project_activity")
            .length,
          representationSets: blocks.filter(
            (b) => b.type === "representation_set",
          ).length,
        },
        generatedAt: new Date().toISOString(),
      };
    });
  }
  async cohort(request: RequestContext, id: string): Promise<never> {
    await this.accounts.actor(request);
    uuid(id);
    throw new ApiFault(
      403,
      "forbidden",
      "تحليلات المجموعة محجوبة حتى اعتماد الربط والصلاحيات والخصوصية.",
    );
  }
}

@Controller("api/v1")
export class CAnalyticsController {
  constructor(readonly analytics: CAnalyticsService) {}
  @Get("learning/analytics/me") me(
    @Req() r: RequestContext,
    @Query() q: Record<string, unknown>,
  ) {
    return this.analytics.me(r, q).then((d) => productEnvelope(r, d));
  }
  @Get("studio/learning-analytics/content") content(
    @Req() r: RequestContext,
    @Query() q: Record<string, unknown>,
  ) {
    return this.analytics
      .contentQuality(r, q)
      .then((d) => productEnvelope(r, d));
  }
  @Get("learning/analytics/cohort/:id") cohort(
    @Req() r: RequestContext,
    @Param("id") id: string,
  ) {
    return this.analytics.cohort(r, id);
  }
}
