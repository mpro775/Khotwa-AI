-- DEV-021…025. Review-only migration: never applied automatically at startup.
CREATE TABLE users (
 id uuid PRIMARY KEY,
 email_normalized varchar(254) NOT NULL UNIQUE,
 email_verified_at timestamptz NOT NULL,
 role text NOT NULL CHECK(role IN ('student','teacher','content_manager','admin')),
 status text NOT NULL CHECK(status IN ('active','suspended','deletion_requested','deleted')),
 is_internal boolean NOT NULL DEFAULT false,
 learning_guest_id uuid UNIQUE REFERENCES guest_sessions(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(email_normalized=lower(email_normalized))
);
CREATE TABLE auth_sessions (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_expiry ON auth_sessions(user_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE email_login_challenges (
 id uuid PRIMARY KEY,
 email_digest bytea NOT NULL CHECK(octet_length(email_digest)=32),
 code_digest bytea NOT NULL CHECK(octet_length(code_digest)=32),
 expires_at timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 consumed_at timestamptz,
 delivery_state text NOT NULL CHECK(delivery_state IN ('pending','sent','failed','suppressed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_challenge_email ON email_login_challenges(email_digest,created_at);
CREATE INDEX login_challenge_expiry ON email_login_challenges(expires_at);
CREATE TABLE account_request_keys (
 id uuid PRIMARY KEY,
 scope_digest bytea NOT NULL CHECK(octet_length(scope_digest)=32),
 operation text NOT NULL,
 key_digest bytea NOT NULL CHECK(octet_length(key_digest)=32),
 fingerprint bytea NOT NULL CHECK(octet_length(fingerprint)=32),
 response jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(scope_digest,operation,key_digest)
);
CREATE TABLE guest_account_claims (
 id uuid PRIMARY KEY,
 guest_session_id uuid NOT NULL UNIQUE REFERENCES guest_sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 target_guest_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
 learning_session_count integer NOT NULL CHECK(learning_session_count>=0),
 consent_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(guest_session_id<>target_guest_id)
);
CREATE TABLE account_deletion_requests (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('requested','processing','completed')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK((status='completed')=(completed_at IS NOT NULL))
);

-- Account-owned learning is durable across guest TTLs. Keep OWN-11 for guests;
-- an explicit account deletion request revokes access and enters the existing
-- seven-day guest retention path without claiming immediate erasure.
GRANT SELECT ON users TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('WHERE LEAST(expires_at,last_seen_at' IN definition)=0 THEN
  RAISE EXCEPTION 'retention baseline differs; review required';
 END IF;
 definition:=replace(definition,
  'WHERE LEAST(expires_at,last_seen_at',
  'WHERE NOT EXISTS(SELECT 1 FROM public.users account_owner WHERE account_owner.learning_guest_id=guest_sessions.id AND account_owner.status=''active'') AND LEAST(expires_at,last_seen_at');
 EXECUTE definition;
END $migration$;
