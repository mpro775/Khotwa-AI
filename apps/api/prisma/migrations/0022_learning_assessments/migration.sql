-- V2.2 orchestration references the existing attempts/verifier, never a second grade store.
CREATE TABLE learning_assessments (
 id uuid PRIMARY KEY, owner_key text NOT NULL, guest_session_id uuid NOT NULL REFERENCES guest_sessions(id),
 subject_code text NOT NULL CHECK(subject_code IN ('algebra','physics','programming')),
 track_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 lesson_revision_id uuid REFERENCES learning_content_revisions(id),
 kind text NOT NULL CHECK(kind IN ('diagnostic_pretest','lesson_check','post_remediation','practice')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 rule_version text NOT NULL, mapping_snapshot jsonb NOT NULL,
 coverage jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX learning_assessment_owner ON learning_assessments(owner_key,created_at DESC,id);
CREATE TABLE learning_assessment_items (
 id uuid PRIMARY KEY, assessment_id uuid NOT NULL REFERENCES learning_assessments(id),
 position integer NOT NULL CHECK(position>0), problem_revision_id uuid NOT NULL,
 problem_snapshot jsonb NOT NULL, attempt_id uuid UNIQUE REFERENCES attempts(id),
 subject_attempt_id uuid UNIQUE REFERENCES subject_attempts(id),
 measurement_exited_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assessment_id,position), UNIQUE(assessment_id,problem_revision_id),
 CHECK(attempt_id IS NULL OR subject_attempt_id IS NULL)
);
CREATE TABLE learning_lesson_events (
 id uuid PRIMARY KEY, owner_key text NOT NULL, lesson_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 event_kind text NOT NULL CHECK(event_kind IN ('lesson_started','lesson_viewed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX learning_lesson_owner ON learning_lesson_events(owner_key,lesson_revision_id,created_at);
CREATE TABLE learning_recommendation_events (
 id uuid PRIMARY KEY, owner_key text NOT NULL, assessment_id uuid REFERENCES learning_assessments(id),
 track_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 rule_version text NOT NULL, recommendation jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_lesson_event BEFORE UPDATE OR DELETE ON learning_lesson_events FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_recommendation_event BEFORE UPDATE OR DELETE ON learning_recommendation_events FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE FUNCTION protect_assessment_sources() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='learning_assessments' THEN
  IF (to_jsonb(NEW)-ARRAY['revision','owner_key','guest_session_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revision','owner_key','guest_session_id']) THEN RAISE EXCEPTION 'assessment sources immutable'; END IF;
  IF (NEW.owner_key<>OLD.owner_key OR NEW.guest_session_id<>OLD.guest_session_id) AND NOT EXISTS(
   SELECT 1 FROM guest_account_claims c WHERE c.guest_session_id=OLD.guest_session_id AND c.target_guest_id=NEW.guest_session_id
   AND OLD.owner_key='guest:'||c.guest_session_id::text AND NEW.owner_key='user:'||c.user_id::text)
  THEN RAISE EXCEPTION 'assessment owner transfer requires explicit claim'; END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['subject_attempt_id','measurement_exited_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['subject_attempt_id','measurement_exited_at'])
   OR (OLD.subject_attempt_id IS NOT NULL AND NEW.subject_attempt_id IS DISTINCT FROM OLD.subject_attempt_id)
   OR (OLD.measurement_exited_at IS NOT NULL AND NEW.measurement_exited_at IS DISTINCT FROM OLD.measurement_exited_at)
  THEN RAISE EXCEPTION 'assessment item source immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_sources BEFORE UPDATE ON learning_assessments FOR EACH ROW EXECUTE FUNCTION protect_assessment_sources();
CREATE TRIGGER assessment_item_sources BEFORE UPDATE ON learning_assessment_items FOR EACH ROW EXECUTE FUNCTION protect_assessment_sources();
CREATE FUNCTION enforce_assessment_item_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM learning_assessments x WHERE x.id=NEW.assessment_id
  AND NEW.problem_snapshot->>'revisionId'=NEW.problem_revision_id::text
  AND NEW.problem_snapshot->>'subject'=x.subject_code
  AND (NEW.attempt_id IS NULL OR EXISTS(SELECT 1 FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id
   WHERE a.id=NEW.attempt_id AND l.guest_session_id=x.guest_session_id AND a.problem_revision_id=NEW.problem_revision_id AND x.subject_code='algebra'))
  AND (NEW.subject_attempt_id IS NULL OR EXISTS(SELECT 1 FROM subject_attempts a WHERE a.id=NEW.subject_attempt_id
   AND a.owner_key=x.owner_key AND a.subject_code=x.subject_code AND a.problem_revision_id=NEW.problem_revision_id)))
 THEN RAISE EXCEPTION 'assessment item scope mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_item_scope BEFORE INSERT OR UPDATE ON learning_assessment_items FOR EACH ROW EXECUTE FUNCTION enforce_assessment_item_scope();
-- Editing through the existing workspace invalidates the assessment revision too.
CREATE FUNCTION invalidate_assessment_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.revision<>OLD.revision OR NEW.assistance_revision<>OLD.assistance_revision THEN
  UPDATE learning_assessments SET revision=revision+1 WHERE id IN(SELECT assessment_id FROM learning_assessment_items WHERE attempt_id=NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_attempt_changed AFTER UPDATE OF revision,assistance_revision ON attempts FOR EACH ROW EXECUTE FUNCTION invalidate_assessment_revision();
CREATE FUNCTION invalidate_subject_assessment_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.revision<>OLD.revision OR NEW.assistance_level<>OLD.assistance_level OR NEW.independent<>OLD.independent THEN
  UPDATE learning_assessments SET revision=revision+1 WHERE id IN(SELECT assessment_id FROM learning_assessment_items WHERE subject_attempt_id=NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_subject_attempt_changed AFTER UPDATE OF revision,assistance_level,independent ON subject_attempts FOR EACH ROW EXECUTE FUNCTION invalidate_subject_assessment_revision();
-- Same explicit account claim and retention policy as the canonical history.
CREATE FUNCTION protect_learning_owner_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='khotwa_retention_executor' AND current_setting('khotwa.retention_job',true)='on' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'owner_key')=(to_jsonb(OLD)-'owner_key') AND EXISTS(
  SELECT 1 FROM guest_account_claims c WHERE OLD.owner_key='guest:'||c.guest_session_id::text AND NEW.owner_key='user:'||c.user_id::text)
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'immutable learning history';
END $$;
DROP TRIGGER immutable_lesson_event ON learning_lesson_events;
DROP TRIGGER immutable_recommendation_event ON learning_recommendation_events;
CREATE TRIGGER immutable_lesson_event BEFORE UPDATE OR DELETE ON learning_lesson_events FOR EACH ROW EXECUTE FUNCTION protect_learning_owner_event();
CREATE TRIGGER immutable_recommendation_event BEFORE UPDATE OR DELETE ON learning_recommendation_events FOR EACH ROW EXECUTE FUNCTION protect_learning_owner_event();
GRANT SELECT,DELETE ON learning_assessments,learning_assessment_items,learning_lesson_events,learning_recommendation_events TO khotwa_retention_executor;
GRANT SELECT ON guest_account_claims TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('DELETE FROM public.subject_attempts' IN definition)=0 OR position('owner_keys' IN definition)=0 THEN RAISE EXCEPTION 'retention baseline differs; review required'; END IF;
 definition:=replace(definition,'DELETE FROM public.subject_attempts',
 $body$
 DELETE FROM public.learning_recommendation_events WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_recommendation_events',affected);
 DELETE FROM public.learning_lesson_events WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_lesson_events',affected);
 DELETE FROM public.learning_assessment_items WHERE assessment_id IN(SELECT id FROM public.learning_assessments WHERE owner_key=ANY(owner_keys));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_assessment_items',affected);
 DELETE FROM public.learning_assessments WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_assessments',affected);
 DELETE FROM public.subject_attempts
 $body$);
 EXECUTE definition;
END $migration$;
