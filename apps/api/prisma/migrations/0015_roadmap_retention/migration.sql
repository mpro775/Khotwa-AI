-- Extend the SAME OWN-11 guest retention implementation; no second retention
-- policy and no automatic erasure claim for account-deletion requests.
GRANT SELECT,DELETE ON subject_attempts,subject_attempt_events,product_mutations,
 beta_feedback,beta_ai_reservations TO khotwa_retention_executor;
GRANT SELECT,DELETE ON email_login_challenges,account_request_keys,auth_sessions TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('DELETE FROM public.skill_evidence' IN definition)=0
 OR position('account_owner.learning_guest_id' IN definition)=0 THEN
  RAISE EXCEPTION 'retention baseline differs; review required';
 END IF;
 definition:=replace(definition,'counts jsonb :=','owner_keys text[]; counts jsonb :=');
 definition:=replace(definition,'DELETE FROM public.skill_evidence',
 $body$
 SELECT array_agg(owner_key) INTO owner_keys FROM (
  SELECT 'guest:'||unnest(guests)::text AS owner_key
  UNION SELECT 'user:'||id::text FROM public.users
   WHERE learning_guest_id=ANY(guests) AND status IN ('deletion_requested','deleted')
 ) relevant_owners;
 DELETE FROM public.subject_attempts WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('subject_attempts',affected);
 DELETE FROM public.product_mutations WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('product_mutations',affected);
 DELETE FROM public.beta_feedback WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('beta_feedback',affected);
 DELETE FROM public.beta_ai_reservations WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('beta_ai_reservations',affected);
 DELETE FROM public.skill_evidence
 $body$);
 EXECUTE definition;
END $migration$;

-- Expired authentication material needs no learning-data retention. A one-hour
-- grace for challenge digests preserves the enforced hourly request-rate count.
CREATE FUNCTION cleanup_expired_account_auth(dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE challenges bigint; action_keys bigint; sessions bigint;
BEGIN
 IF dry_run IS NULL THEN RAISE EXCEPTION 'invalid cleanup option'; END IF;
 PERFORM pg_advisory_xact_lock(71941020261108);
 SELECT count(*) INTO challenges FROM public.email_login_challenges WHERE expires_at<now()-interval '1 hour';
 SELECT count(*) INTO action_keys FROM public.account_request_keys WHERE expires_at<=now();
 SELECT count(*) INTO sessions FROM public.auth_sessions WHERE expires_at<=now() OR revoked_at IS NOT NULL;
 IF NOT dry_run THEN
  DELETE FROM public.email_login_challenges WHERE expires_at<now()-interval '1 hour';
  DELETE FROM public.account_request_keys WHERE expires_at<=now();
  DELETE FROM public.auth_sessions WHERE expires_at<=now() OR revoked_at IS NOT NULL;
 END IF;
 RETURN jsonb_build_object('dryRun',dry_run,'expiredChallenges',challenges,'expiredActionKeys',action_keys,'expiredSessions',sessions);
END $$;
GRANT CREATE ON SCHEMA public TO khotwa_retention_executor;
ALTER FUNCTION cleanup_expired_account_auth(boolean) OWNER TO khotwa_retention_executor;
REVOKE CREATE ON SCHEMA public FROM khotwa_retention_executor;
REVOKE ALL ON FUNCTION cleanup_expired_account_auth(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_account_auth(boolean) TO khotwa_retention_operator;
