-- Review-only lifecycle fix. Never apply from application startup.
-- Claimed evidence is durable account data, including while access is suspended.
-- Keep the original seven-day policy for genuinely unclaimed guest data.
GRANT SELECT ON guest_account_claims TO khotwa_retention_executor;

DO $migration$
DECLARE
 definition text;
 previous_selection text := 'WHERE NOT EXISTS(SELECT 1 FROM public.users account_owner WHERE account_owner.learning_guest_id=guest_sessions.id AND account_owner.status=''active'') AND LEAST(expires_at,last_seen_at';
 replacement_selection text := $selection$
WHERE NOT EXISTS(
 SELECT 1 FROM public.users account_owner
 WHERE account_owner.learning_guest_id=guest_sessions.id
 AND account_owner.status NOT IN ('deletion_requested','deleted')
)
AND NOT EXISTS(
 SELECT 1 FROM public.guest_account_claims claim
 JOIN public.users account_owner ON account_owner.id=claim.user_id
 WHERE claim.guest_session_id=guest_sessions.id
 AND account_owner.status NOT IN ('deletion_requested','deleted')
)
-- Do not delete a claimed source's cache before the durable account's reports
-- and hints referencing it. After account deletion, the canonical history is
-- purged first and this source can enter a later batch. Same-owner unclaimed
-- guest reports remain eligible for the existing ordered cleanup.
AND NOT EXISTS(
 SELECT 1 FROM public.idempotency_records key_record
 JOIN public.verification_reports report ON report.idempotency_record_id=key_record.id
 JOIN public.attempts attempt ON attempt.id=report.attempt_id
 JOIN public.learning_sessions learning ON learning.id=attempt.learning_session_id
 WHERE key_record.guest_session_id=guest_sessions.id
 AND learning.guest_session_id<>guest_sessions.id
)
AND NOT EXISTS(
 SELECT 1 FROM public.idempotency_records key_record
 JOIN public.hint_requests hint ON hint.idempotency_record_id=key_record.id
 JOIN public.attempts attempt ON attempt.id=hint.attempt_id
 JOIN public.learning_sessions learning ON learning.id=attempt.learning_session_id
 WHERE key_record.guest_session_id=guest_sessions.id
 AND learning.guest_session_id<>guest_sessions.id
)
AND LEAST(expires_at,last_seen_at$selection$;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position(previous_selection IN definition)=0
 OR position('DELETE FROM public.subject_attempts' IN definition)=0
 OR position('counts jsonb :=' IN definition)=0 THEN
  RAISE EXCEPTION 'retention baseline differs; review required';
 END IF;
 definition:=replace(definition,previous_selection,replacement_selection);
 -- CREATE OR REPLACE preserves the existing function owner and EXECUTE grants.
 -- Its SECURITY DEFINER/search_path and deletion order are unchanged.
 EXECUTE definition;
END $migration$;
