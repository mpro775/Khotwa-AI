-- Review-only migration: no Runner is enabled or migration executed at startup.
-- Protected author response caches can contain private content; they are never
-- queried by a public catalog/student endpoint and follow owner erasure cleanup.
-- Remote tokens are backend-only reconciliation receipts, never student output.
CREATE TABLE runner_work_requests (
 id uuid PRIMARY KEY,
 owner_key text NOT NULL, operation text NOT NULL, key_digest text NOT NULL,
 fingerprint text NOT NULL,
 state text NOT NULL CHECK(state IN ('running','completed','failed','interrupted')),
 lease_token uuid NOT NULL, lease_until timestamptz NOT NULL,
 reserved_runs integer NOT NULL CHECK(reserved_runs BETWEEN 0 AND 20),
 attempt_id uuid REFERENCES subject_attempts(id) ON DELETE CASCADE,
 attempt_revision integer CHECK(attempt_revision>=0),
 remote_tokens jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(remote_tokens)='array' AND jsonb_array_length(remote_tokens)<=20),
 response_cache jsonb, fault_cache jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 expires_at timestamptz NOT NULL,
 UNIQUE(owner_key,operation,key_digest),
 CHECK((attempt_id IS NULL)=(attempt_revision IS NULL)),
 CHECK(response_cache IS NULL OR jsonb_typeof(response_cache)='object'),
 CHECK(fault_cache IS NULL OR jsonb_typeof(fault_cache)='object')
);
CREATE INDEX runner_work_owner_quota ON runner_work_requests(owner_key,created_at DESC);
CREATE INDEX runner_work_active ON runner_work_requests(state,lease_until) WHERE state IN ('running','interrupted');
CREATE INDEX runner_work_expiry ON runner_work_requests(expires_at);
GRANT SELECT,DELETE ON runner_work_requests TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('DELETE FROM public.subject_attempts WHERE owner_key=ANY(owner_keys);' IN definition)=0
 OR position('AND LEAST(expires_at,last_seen_at' IN definition)=0
 OR position('PERFORM pg_advisory_xact_lock(71941020261106);' IN definition)=0 THEN
  RAISE EXCEPTION 'retention baseline differs; review required';
 END IF;
 -- Retention must not silently release quarantined capacity or lose private
 -- reconciliation receipts. It uses the same global reservation lock.
 definition:=replace(definition,'PERFORM pg_advisory_xact_lock(71941020261106);',
 'PERFORM pg_advisory_xact_lock(71941020261106); PERFORM pg_advisory_xact_lock(71941020261118);');
 definition:=replace(definition,'AND LEAST(expires_at,last_seen_at',
 $selection$AND NOT EXISTS(
 SELECT 1 FROM public.runner_work_requests runner_job
 WHERE runner_job.state IN ('running','interrupted')
 AND (runner_job.owner_key='guest:'||guest_sessions.id::text
 OR runner_job.owner_key IN (
  SELECT 'user:'||account_owner.id::text FROM public.users account_owner
  WHERE account_owner.learning_guest_id=guest_sessions.id
  OR EXISTS(SELECT 1 FROM public.guest_account_claims claim
   WHERE claim.user_id=account_owner.id AND claim.guest_session_id=guest_sessions.id)
 ))
 ) AND LEAST(expires_at,last_seen_at$selection$);
 definition:=replace(definition,'DELETE FROM public.subject_attempts WHERE owner_key=ANY(owner_keys);',
 $body$DELETE FROM public.runner_work_requests WHERE owner_key=ANY(owner_keys);
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('runner_work_requests',affected);
 DELETE FROM public.subject_attempts WHERE owner_key=ANY(owner_keys);$body$);
 EXECUTE definition;
END $migration$;
