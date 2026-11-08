-- Expand-only C. No startup migration, no new retention duration or mastery store.
ALTER TABLE intelligent_learning_records DROP CONSTRAINT intelligent_learning_records_kind_check;
ALTER TABLE intelligent_learning_records ADD CONSTRAINT intelligent_learning_records_kind_check
 CHECK(kind IN ('decision','activity','review','tutor','goal','reflection','scaffold','lab','problem_session','project_run'));
CREATE INDEX intelligent_learning_c_lesson ON intelligent_learning_records
 (owner_key,(data->>'lessonRevisionId'),kind) WHERE kind IN ('problem_session','project_run');

CREATE TABLE learning_content_reviews (
 id uuid PRIMARY KEY, revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 reviewer_id uuid NOT NULL REFERENCES users(id), reviewer_role text NOT NULL CHECK(reviewer_role IN ('admin','content_manager')),
 scope text NOT NULL CHECK(scope IN ('subject','pedagogy','accessibility','security')),
 content_hash text NOT NULL CHECK(length(content_hash)=64), decision text NOT NULL CHECK(decision IN ('approve','changes_requested')),
 notes_ar text NOT NULL CHECK(length(notes_ar)<=2000), review_mode text NOT NULL CHECK(review_mode IN ('TEST_ONLY','HUMAN_REVIEW')),
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX learning_content_review_gate ON learning_content_reviews(revision_id,content_hash,scope,reviewed_at);

CREATE TABLE learning_project_submissions (
 id uuid PRIMARY KEY, project_run_id uuid NOT NULL REFERENCES intelligent_learning_records(id),
 revision integer NOT NULL CHECK(revision>=0), milestone_code text NOT NULL CHECK(length(milestone_code) BETWEEN 1 AND 80),
 artifact_kind text NOT NULL CHECK(artifact_kind IN ('text','json','code_text','table')),
 artifact_json jsonb NOT NULL CHECK(octet_length(artifact_json::text)<=40000),
 status text NOT NULL CHECK(status='awaiting_feedback'), is_final boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_run_id,revision)
);
CREATE INDEX learning_project_submission_run ON learning_project_submissions(project_run_id,created_at,id);
CREATE TABLE learning_project_reviews (
 id uuid PRIMARY KEY, submission_id uuid NOT NULL UNIQUE REFERENCES learning_project_submissions(id),
 rubric_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id), reviewer_id uuid NOT NULL REFERENCES users(id),
 reviewer_role text NOT NULL CHECK(reviewer_role IN ('admin','content_manager')),
 rubric_results jsonb NOT NULL CHECK(jsonb_typeof(rubric_results)='array' AND octet_length(rubric_results::text)<=32768),
 feedback_ar text NOT NULL CHECK(length(feedback_ar) BETWEEN 1 AND 2000),
 decision text NOT NULL CHECK(decision IN ('accepted','revision_requested')),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Artifacts and review provenance are immutable, including after account claim.
CREATE FUNCTION protect_c_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='khotwa_retention_executor' AND current_setting('khotwa.retention_job',true)='on' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'C revisions are immutable; submit a new revision';
END $$;
CREATE TRIGGER immutable_c_submission BEFORE UPDATE OR DELETE ON learning_project_submissions FOR EACH ROW EXECUTE FUNCTION protect_c_revision();
CREATE TRIGGER immutable_c_review BEFORE UPDATE OR DELETE ON learning_project_reviews FOR EACH ROW EXECUTE FUNCTION protect_c_revision();
CREATE TRIGGER immutable_c_content_review BEFORE UPDATE OR DELETE ON learning_content_reviews FOR EACH ROW EXECUTE FUNCTION protect_c_revision();

-- Rebuildable, allowlisted projections. No raw learner answers or content keys.
CREATE TABLE learning_analytics_events (
 id uuid PRIMARY KEY, owner_key text NOT NULL CHECK(owner_key ~ '^(guest|user):[0-9a-f-]{36}$'),
 track_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 source_table text NOT NULL CHECK(source_table IN ('canonical_assessment_context','intelligent_learning_records')),
 source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 100), source_revision integer NOT NULL CHECK(source_revision>=0),
 event_type text NOT NULL CHECK(event_type IN ('assessment_observed','problem_activity','project_activity')),
 event_version text NOT NULL CHECK(event_version='c-analytics-event-v1'),
 occurred_at timestamptz NOT NULL, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=4096),
 UNIQUE(owner_key,track_revision_id,source_table,source_id,event_type)
);
CREATE INDEX learning_analytics_owner_window ON learning_analytics_events(owner_key,track_revision_id,occurred_at);
CREATE TABLE learning_analytics_projection_cursor (
 owner_key text NOT NULL, track_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 metric_version text NOT NULL, source_fingerprint text NOT NULL CHECK(length(source_fingerprint)=64),
 projected_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_key,track_revision_id,metric_version)
);
CREATE TABLE learning_metrics_snapshots (
 owner_key text NOT NULL, track_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 metric_version text NOT NULL, window_days integer NOT NULL CHECK(window_days IN (7,14,30)),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=32768),
 generated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_key,track_revision_id,metric_version,window_days)
);
GRANT SELECT,DELETE ON learning_project_submissions,learning_project_reviews,learning_analytics_events,learning_analytics_projection_cursor,learning_metrics_snapshots TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('DELETE FROM public.intelligent_learning_events' IN definition)=0 THEN RAISE EXCEPTION 'C retention baseline differs; review required'; END IF;
 definition:=replace(definition,'DELETE FROM public.intelligent_learning_events',
 $body$
 DELETE FROM public.learning_project_reviews WHERE submission_id IN (SELECT s.id FROM public.learning_project_submissions s JOIN public.intelligent_learning_records r ON r.id=s.project_run_id WHERE r.owner_key=ANY(owner_keys));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_project_reviews',affected);
 DELETE FROM public.learning_project_submissions WHERE project_run_id IN (SELECT id FROM public.intelligent_learning_records WHERE owner_key=ANY(owner_keys));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_project_submissions',affected);
 DELETE FROM public.learning_analytics_events WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_analytics_events',affected);
 DELETE FROM public.learning_analytics_projection_cursor WHERE owner_key=ANY(owner_keys);
 DELETE FROM public.learning_metrics_snapshots WHERE owner_key=ANY(owner_keys);
 DELETE FROM public.intelligent_learning_events
 $body$);
 EXECUTE definition;
END $migration$;
