-- Expand-only A1–A8 state; NOT applied by application startup.
-- No new math truth/evidence store and no new retention duration.
ALTER TABLE learning_assessments DROP CONSTRAINT learning_assessments_kind_check;
ALTER TABLE learning_assessments ADD CONSTRAINT learning_assessments_kind_check
 CHECK(kind IN ('diagnostic_pretest','lesson_check','post_remediation','practice','independent_check','retrieval_review'));

CREATE TABLE intelligent_learning_records (
 id uuid PRIMARY KEY, owner_key text NOT NULL CHECK(owner_key ~ '^(guest|user):[0-9a-f-]{36}$'),
 kind text NOT NULL CHECK(kind IN ('decision','activity','review','tutor','goal','reflection','scaffold')),
 track_revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 parent_id uuid, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=131072),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_key,id),
 FOREIGN KEY(owner_key,parent_id) REFERENCES intelligent_learning_records(owner_key,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX intelligent_learning_owner_kind ON intelligent_learning_records(owner_key,kind,track_revision_id,created_at);
CREATE UNIQUE INDEX intelligent_learning_decision_accept ON intelligent_learning_records(owner_key,parent_id) WHERE kind='activity' AND parent_id IS NOT NULL;
CREATE UNIQUE INDEX intelligent_learning_review_anchor ON intelligent_learning_records(owner_key,track_revision_id,(data->>'skillCode'),(data->>'sourceEvidenceId'),(data->>'policyVersion')) WHERE kind='review';
CREATE INDEX intelligent_learning_due ON intelligent_learning_records(owner_key,(data->>'dueAt')) WHERE kind='review';
CREATE TABLE intelligent_learning_events (
 id uuid PRIMARY KEY, record_id uuid NOT NULL,
 owner_key text NOT NULL, revision integer NOT NULL CHECK(revision>=0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(record_id,revision),
 FOREIGN KEY(owner_key,record_id) REFERENCES intelligent_learning_records(owner_key,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX intelligent_learning_event_owner ON intelligent_learning_events(owner_key,created_at);
CREATE TRIGGER immutable_intelligent_event BEFORE UPDATE OR DELETE ON intelligent_learning_events FOR EACH ROW EXECUTE FUNCTION protect_learning_owner_event();
CREATE FUNCTION protect_intelligent_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF current_user='khotwa_retention_executor' AND current_setting('khotwa.retention_job',true)='on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'intelligent learning history uses existing retention path';
 END IF;
 IF NEW.owner_key<>OLD.owner_key THEN
  IF (to_jsonb(NEW)-'owner_key')<>(to_jsonb(OLD)-'owner_key') OR NOT EXISTS(
   SELECT 1 FROM guest_account_claims c WHERE OLD.owner_key='guest:'||c.guest_session_id::text AND NEW.owner_key='user:'||c.user_id::text)
  THEN RAISE EXCEPTION 'intelligent owner transfer requires explicit claim'; END IF;
 ELSE
  IF NEW.revision<>OLD.revision+1 OR NEW.kind<>OLD.kind OR NEW.track_revision_id<>OLD.track_revision_id
   OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'intelligent record revision/source mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER intelligent_record_history BEFORE UPDATE OR DELETE ON intelligent_learning_records FOR EACH ROW EXECUTE FUNCTION protect_intelligent_record();
GRANT SELECT,DELETE ON intelligent_learning_records,intelligent_learning_events TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('DELETE FROM public.learning_recommendation_events' IN definition)=0 OR position('owner_keys' IN definition)=0 THEN RAISE EXCEPTION 'retention baseline differs; review required'; END IF;
 definition:=replace(definition,'DELETE FROM public.learning_recommendation_events',
 $body$
 DELETE FROM public.intelligent_learning_events WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('intelligent_learning_events',affected);
 DELETE FROM public.intelligent_learning_records WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('intelligent_learning_records',affected);
 DELETE FROM public.learning_recommendation_events
 $body$);
 EXECUTE definition;
END $migration$;
