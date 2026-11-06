-- OWN-11 / SEC-DEC-04. No public API, no changes to mathematical evidence.
-- The NOLOGIN definer is never granted to the application or operator role.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='khotwa_retention_executor') THEN
  CREATE ROLE khotwa_retention_executor NOLOGIN NOINHERIT;
 END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='khotwa_retention_operator') THEN
  CREATE ROLE khotwa_retention_operator NOLOGIN;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO khotwa_retention_executor,khotwa_retention_operator;
GRANT SELECT,DELETE ON guest_sessions,learning_sessions,attempts,step_slots,step_versions,
 parse_results,verification_runs,verification_results,verification_reports,diagnoses,
 diagnostic_probes,probe_responses,hint_requests,tutoring_events,learning_episodes,
 learning_assignments,content_exposures,skill_evidence,idempotency_records,audit_events,
 ai_budget_ledgers TO khotwa_retention_executor;
GRANT UPDATE ON guest_sessions TO khotwa_retention_executor;

-- A caller-set GUC alone cannot bypass history. Only the inaccessible function
-- owner may DELETE, and UPDATE remains forbidden under every identity.
CREATE OR REPLACE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='khotwa_retention_executor'
 AND current_setting('khotwa.retention_job',true)='on' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'immutable history';
END $$;
CREATE OR REPLACE FUNCTION protect_ph06_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='khotwa_retention_executor'
 AND current_setting('khotwa.retention_job',true)='on' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'immutable diagnostic history';
END $$;
CREATE OR REPLACE FUNCTION protect_finished_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='khotwa_retention_executor'
 AND current_setting('khotwa.retention_job',true)='on' THEN RETURN OLD; END IF;
 IF OLD.dispatch_status='finished' THEN RAISE EXCEPTION 'immutable verification report'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION purge_expired_guests(dry_run boolean DEFAULT true,batch_size integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 cutoff timestamptz := clock_timestamp();
 guests uuid[]; sessions uuid[]; attempt_ids uuid[];
 counts jsonb := '{}'::jsonb; affected integer; previous_flag text;
BEGIN
 IF dry_run IS NULL OR batch_size IS NULL OR batch_size<1 OR batch_size>1000 THEN
  RAISE EXCEPTION 'invalid retention options';
 END IF;
 PERFORM pg_advisory_xact_lock(71941020261106);
 SELECT array_agg(id) INTO guests FROM (
  SELECT id FROM public.guest_sessions
  WHERE LEAST(expires_at,last_seen_at+interval '2 hours',revoked_at)+interval '7 days'<=cutoff
  ORDER BY id LIMIT batch_size FOR UPDATE
 ) eligible;
 IF dry_run OR guests IS NULL THEN
  RETURN jsonb_build_object('dryRun',dry_run,'at',cutoff,'eligibleGuests',COALESCE(cardinality(guests),0),
   'deletedGuests',0,'counts',counts,'policy','OWN-11/SEC-DEC-04');
 END IF;
 SELECT array_agg(id) INTO sessions FROM public.learning_sessions WHERE guest_session_id=ANY(guests);
 SELECT array_agg(id) INTO attempt_ids FROM public.attempts WHERE learning_session_id=ANY(sessions);
 previous_flag:=current_setting('khotwa.retention_job',true);
 PERFORM set_config('khotwa.retention_job','on',true);
 SET CONSTRAINTS public.current_version_exists DEFERRED;
 DELETE FROM public.skill_evidence WHERE learning_session_id=ANY(sessions);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('skill_evidence',affected);
 DELETE FROM public.learning_assignments WHERE episode_id IN(SELECT id FROM public.learning_episodes WHERE root_attempt_id=ANY(attempt_ids));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_assignments',affected);
 DELETE FROM public.learning_episodes WHERE root_attempt_id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_episodes',affected);
 DELETE FROM public.tutoring_events WHERE attempt_id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('tutoring_events',affected);
 DELETE FROM public.hint_requests WHERE attempt_id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('hint_requests',affected);
 DELETE FROM public.probe_responses WHERE probe_id IN(SELECT p.id FROM public.diagnostic_probes p JOIN public.diagnoses d ON d.id=p.diagnosis_id WHERE d.attempt_id=ANY(attempt_ids));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('probe_responses',affected);
 DELETE FROM public.diagnostic_probes WHERE diagnosis_id IN(SELECT id FROM public.diagnoses WHERE attempt_id=ANY(attempt_ids));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('diagnostic_probes',affected);
 DELETE FROM public.diagnoses WHERE attempt_id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('diagnoses',affected);
 DELETE FROM public.verification_results WHERE verification_run_id IN(SELECT id FROM public.verification_runs WHERE attempt_id=ANY(attempt_ids));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('verification_results',affected);
 DELETE FROM public.verification_runs WHERE attempt_id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('verification_runs',affected);
 DELETE FROM public.verification_reports WHERE attempt_id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('verification_reports',affected);
 DELETE FROM public.parse_results WHERE step_version_id IN(SELECT v.id FROM public.step_versions v JOIN public.step_slots s ON s.id=v.step_slot_id WHERE s.attempt_id=ANY(attempt_ids));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('parse_results',affected);
 DELETE FROM public.step_versions WHERE step_slot_id IN(SELECT id FROM public.step_slots WHERE attempt_id=ANY(attempt_ids));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('step_versions',affected);
 DELETE FROM public.step_slots WHERE attempt_id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('step_slots',affected);
 DELETE FROM public.attempts WHERE id=ANY(attempt_ids);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('attempts',affected);
 DELETE FROM public.learning_sessions WHERE id=ANY(sessions);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('learning_sessions',affected);
 DELETE FROM public.content_exposures WHERE guest_session_id=ANY(guests);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('content_exposures',affected);
 DELETE FROM public.idempotency_records WHERE guest_session_id=ANY(guests);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('idempotency_records',affected);
 DELETE FROM public.ai_budget_ledgers WHERE scope IN(SELECT 'guest:'||unnest(guests)::text);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('ai_budget_ledgers',affected);
 DELETE FROM public.audit_events WHERE (entity_kind='guest' AND entity_id=ANY(guests)) OR (entity_kind='attempt' AND entity_id=ANY(attempt_ids));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('audit_events',affected);
 DELETE FROM public.guest_sessions WHERE id=ANY(guests);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('guest_sessions',affected);
 PERFORM set_config('khotwa.retention_job',COALESCE(previous_flag,''),true);
 RETURN jsonb_build_object('dryRun',false,'at',cutoff,'eligibleGuests',cardinality(guests),
  'deletedGuests',affected,'counts',counts,'policy','OWN-11/SEC-DEC-04');
END $$;
-- Function ownership requires CREATE only during migration. Runtime has neither
-- role membership nor function execution; maintenance gets execution only.
GRANT CREATE ON SCHEMA public TO khotwa_retention_executor;
ALTER FUNCTION purge_expired_guests(boolean,integer) OWNER TO khotwa_retention_executor;
REVOKE CREATE ON SCHEMA public FROM khotwa_retention_executor;
REVOKE ALL ON FUNCTION purge_expired_guests(boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_guests(boolean,integer) TO khotwa_retention_operator;
