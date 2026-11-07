-- DEV-052…056. No learner code or private request body is logged here.
CREATE TABLE beta_feedback (
 id uuid PRIMARY KEY,
 owner_key text NOT NULL CHECK(owner_key ~ '^(user|guest):[0-9a-f-]{36}$'),
 kind text NOT NULL CHECK(kind IN ('bug','content','suggestion','other')),
 message_redacted text NOT NULL CHECK(length(message_redacted) BETWEEN 1 AND 2000),
 request_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX beta_feedback_owner_created ON beta_feedback(owner_key,created_at);
CREATE TABLE beta_ai_reservations (
 id uuid PRIMARY KEY,
 owner_key text NOT NULL CHECK(owner_key ~ '^(user|guest):[0-9a-f-]{36}$'),
 maximum_tokens integer NOT NULL CHECK(maximum_tokens>0),
 maximum_cost_micros bigint NOT NULL CHECK(maximum_cost_micros>0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX beta_ai_reservations_owner_created ON beta_ai_reservations(owner_key,created_at);
