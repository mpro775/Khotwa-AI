-- Source-only opt-in policies. Defaults never activate real learning or AI.
CREATE TABLE account_learning_consents (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 policy_version varchar(80) NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE account_ai_consents (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 policy_version varchar(80) NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE external_ai_runtime (
 authorization_id varchar(160) PRIMARY KEY,
 quota_stopped boolean NOT NULL DEFAULT false,
 reserved_calls integer NOT NULL DEFAULT 0 CHECK(reserved_calls>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE beta_ai_reservations ADD COLUMN authorization_id varchar(160);
ALTER TABLE beta_ai_reservations ADD COLUMN model varchar(120);
ALTER TABLE beta_ai_reservations ADD COLUMN deadline_at timestamptz;
ALTER TABLE beta_ai_reservations ADD COLUMN finished_at timestamptz;
CREATE INDEX beta_ai_authorization_calls ON beta_ai_reservations(authorization_id,created_at);
GRANT SELECT,DELETE ON account_learning_consents,account_ai_consents TO khotwa_retention_executor;

-- Erasing an account must not make the already-reserved global monthly budget
-- available again. Remove its owner link while retaining only the accounting
-- fields for the configured UTC quota month. This is not an invoice ledger or
-- a claim that identity/backups have been fully erased.
GRANT UPDATE(owner_key) ON beta_ai_reservations TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('DELETE FROM public.beta_ai_reservations WHERE owner_key=ANY(owner_keys);' IN definition)=0
 OR position('IF dry_run OR guests IS NULL THEN' IN definition)=0
 OR position('PERFORM pg_advisory_xact_lock(71941020261118);' IN definition)=0 THEN
  RAISE EXCEPTION 'retention accounting baseline differs; review required';
 END IF;
 definition:=replace(definition,'DELETE FROM public.beta_ai_reservations WHERE owner_key=ANY(owner_keys);',
 $body$UPDATE public.beta_ai_reservations SET owner_key='accounting:retired'
 WHERE owner_key=ANY(owner_keys)
 AND (created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
 OR created_at>now()-interval '60 seconds'
 OR (finished_at IS NULL AND deadline_at>now()));
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('deidentified_beta_ai_reservations',affected);
 DELETE FROM public.beta_ai_reservations WHERE owner_key=ANY(owner_keys);$body$);
 -- This runs under the existing retention lock even when no guest is eligible.
 -- Dry-run remains read-only and does not clean up retired accounting rows.
 definition:=replace(definition,'IF dry_run OR guests IS NULL THEN',
 $body$IF NOT dry_run THEN
 DELETE FROM public.beta_ai_reservations WHERE owner_key='accounting:retired'
 AND created_at<date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
 AND created_at<=now()-interval '60 seconds'
 AND (finished_at IS NOT NULL OR deadline_at IS NULL OR deadline_at<=now());
 GET DIAGNOSTICS affected=ROW_COUNT; counts:=counts||jsonb_build_object('expired_retired_beta_ai_reservations',affected);
 END IF;
 IF dry_run OR guests IS NULL THEN$body$);
 -- CREATE OR REPLACE retains the SECURITY DEFINER owner and EXECUTE grants.
 EXECUTE definition;
END $migration$;
