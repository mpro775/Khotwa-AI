-- PH-04 data foundation. No educational publication/seed is performed here.
CREATE TABLE content_releases (
 id uuid PRIMARY KEY, release_code varchar(80) NOT NULL UNIQUE,
 subject_code varchar(40) NOT NULL CHECK (subject_code='algebra'),
 notation_profile varchar(80) NOT NULL CHECK(notation_profile='ar-mashriq-school-v1'),
 curriculum_label_ar text NOT NULL, status text NOT NULL CHECK(status IN ('draft','reviewed','published','retired')),
 reviewed_by_role text, reviewed_at timestamptz, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'published' OR (reviewed_at IS NOT NULL AND published_at IS NOT NULL AND reviewed_by_role IS NOT NULL))
);
CREATE TABLE skills (
 id uuid PRIMARY KEY, release_id uuid NOT NULL REFERENCES content_releases(id), skill_code varchar(80) NOT NULL,
 name_ar text NOT NULL, learning_objective_ar text NOT NULL, sort_order integer NOT NULL,
 status text NOT NULL CHECK(status IN ('active','archived')), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(release_id,skill_code)
);
CREATE TABLE skill_prerequisites (
 skill_id uuid NOT NULL REFERENCES skills(id), prerequisite_skill_id uuid NOT NULL REFERENCES skills(id),
 relation_kind text NOT NULL CHECK(relation_kind IN ('required','recommended')), rationale_ar text,
 PRIMARY KEY(skill_id,prerequisite_skill_id), CHECK(skill_id<>prerequisite_skill_id)
);
CREATE TABLE problems (
 id uuid PRIMARY KEY, problem_code varchar(80) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
CREATE TABLE problem_revisions (
 id uuid PRIMARY KEY, problem_id uuid NOT NULL REFERENCES problems(id), version_number integer NOT NULL CHECK(version_number>0),
 release_id uuid NOT NULL REFERENCES content_releases(id), item_kind text NOT NULL CHECK(item_kind IN ('main','remediation','transfer','diagnostic')),
 statement_ar text NOT NULL, original_equation_raw text, original_equation_ast jsonb, answer_spec jsonb NOT NULL,
 difficulty_band smallint NOT NULL CHECK(difficulty_band BETWEEN 1 AND 5), notation_profile varchar(80) NOT NULL,
 review_status text NOT NULL CHECK(review_status IN ('draft','reviewed','published','retired')),
 reviewed_at timestamptz, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), content_hash text NOT NULL,
 UNIQUE(problem_id,version_number), UNIQUE(id,release_id),
 CHECK(original_equation_raw IS NULL OR char_length(original_equation_raw) BETWEEN 1 AND 256),
 CHECK(review_status<>'published' OR (reviewed_at IS NOT NULL AND published_at IS NOT NULL))
);
CREATE TABLE problem_skills (
 problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id), skill_id uuid NOT NULL REFERENCES skills(id),
 coverage_kind text NOT NULL CHECK(coverage_kind IN ('primary','secondary')), PRIMARY KEY(problem_revision_id,skill_id)
);
CREATE UNIQUE INDEX one_primary_skill ON problem_skills(problem_revision_id) WHERE coverage_kind='primary';
CREATE TABLE guest_sessions (
 id uuid PRIMARY KEY, token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
 status text NOT NULL CHECK(status IN ('active','expired','revoked')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz, consent_snapshot jsonb, CHECK(expires_at>created_at)
);
CREATE INDEX guest_expiry ON guest_sessions(expires_at);
CREATE TABLE learning_sessions (
 id uuid PRIMARY KEY, guest_session_id uuid NOT NULL REFERENCES guest_sessions(id), release_id uuid NOT NULL REFERENCES content_releases(id),
 status text NOT NULL CHECK(status IN ('active','ended','abandoned')), started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 is_synthetic boolean NOT NULL DEFAULT false, session_policy_version varchar(80) NOT NULL, UNIQUE(id,release_id)
);
CREATE INDEX learning_owner ON learning_sessions(guest_session_id,id);
CREATE TABLE attempts (
 id uuid PRIMARY KEY, learning_session_id uuid NOT NULL REFERENCES learning_sessions(id), problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 attempt_kind text NOT NULL CHECK(attempt_kind IN ('main','probe','remediation','transfer')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 2147483647),
 status text NOT NULL CHECK(status IN ('in_progress','completed','assisted_completed','stopped')),
 completion_verdict text CHECK(completion_verdict IN ('verified_complete','not_complete','unknown')),
 opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 notation_profile varchar(80) NOT NULL
);
CREATE INDEX attempt_learning ON attempts(learning_session_id,id);
CREATE TABLE step_slots (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES attempts(id), position integer NOT NULL CHECK(position>0),
 is_active boolean NOT NULL DEFAULT true, current_version integer NOT NULL CHECK(current_version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX active_step_position ON step_slots(attempt_id,position) WHERE is_active;
CREATE TABLE step_versions (
 id uuid PRIMARY KEY, step_slot_id uuid NOT NULL REFERENCES step_slots(id), version_number integer NOT NULL CHECK(version_number>0),
 source_raw text NOT NULL CHECK(char_length(source_raw) BETWEEN 1 AND 256),
 input_origin text NOT NULL CHECK(input_origin IN ('keyboard','math_editor')),
 created_at timestamptz NOT NULL DEFAULT now(), supersedes_step_version_id uuid,
 UNIQUE(step_slot_id,version_number), UNIQUE(step_slot_id,id),
 FOREIGN KEY(step_slot_id,supersedes_step_version_id) REFERENCES step_versions(step_slot_id,id)
);
ALTER TABLE step_slots ADD CONSTRAINT current_version_exists FOREIGN KEY(id,current_version)
 REFERENCES step_versions(step_slot_id,version_number) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE parse_results (
 id uuid PRIMARY KEY, step_version_id uuid NOT NULL REFERENCES step_versions(id), engine_version varchar(80) NOT NULL,
 notation_profile_version varchar(80) NOT NULL, parse_status text NOT NULL CHECK(parse_status IN ('parsed','syntax_error','unsupported','inconclusive','service_error')),
 normalized_text text, display_text text, ast jsonb, reason_code text, issue_span jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((parse_status='parsed' AND ast IS NOT NULL AND normalized_text IS NOT NULL AND display_text IS NOT NULL) OR (parse_status<>'parsed' AND ast IS NULL AND normalized_text IS NULL AND display_text IS NULL))
);
CREATE INDEX parses_by_version ON parse_results(step_version_id,engine_version,notation_profile_version,created_at DESC);
CREATE TABLE verification_runs (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES attempts(id), request_key_hash bytea NOT NULL,
 attempt_revision_requested bigint NOT NULL CHECK(attempt_revision_requested BETWEEN 0 AND 2147483647),
 problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id), from_kind text NOT NULL,
 from_step_version_id uuid REFERENCES step_versions(id), to_step_version_id uuid NOT NULL REFERENCES step_versions(id),
 notation_profile_version varchar(80) NOT NULL, engine_version_requested varchar(80) NOT NULL,
 dispatch_status text NOT NULL CHECK(dispatch_status IN ('queued','running','finished','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 CHECK((from_kind='problem' AND from_step_version_id IS NULL) OR (from_kind='step' AND from_step_version_id IS NOT NULL)),
 UNIQUE(attempt_id,request_key_hash,from_step_version_id,to_step_version_id)
);
CREATE INDEX runs_revision ON verification_runs(attempt_id,attempt_revision_requested);
CREATE TABLE verification_results (
 id uuid PRIMARY KEY, verification_run_id uuid NOT NULL UNIQUE REFERENCES verification_runs(id),
 math_status text NOT NULL CHECK(math_status IN ('verified_valid','verified_invalid','syntax_error','unsupported','inconclusive','service_error')),
 reason_code text, evidence_kind text CHECK(evidence_kind IN ('counterexample','solution_set','rule_violation','none')),
 evidence_json jsonb, engine_version_actual varchar(80) NOT NULL, schema_version varchar(80) NOT NULL,
 notation_profile_version varchar(80) NOT NULL, validated_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 CHECK(math_status<>'verified_invalid' OR (evidence_json IS NOT NULL AND evidence_kind IN ('counterexample','solution_set','rule_violation')))
);
CREATE TABLE idempotency_records (
 id uuid PRIMARY KEY, guest_session_id uuid NOT NULL REFERENCES guest_sessions(id), operation varchar(200) NOT NULL,
 key_digest bytea NOT NULL CHECK(octet_length(key_digest)=32), fingerprint bytea NOT NULL CHECK(octet_length(fingerprint)=32),
 state text NOT NULL CHECK(state IN ('processing','completed','failed')), response_code smallint, response_cache jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 UNIQUE(guest_session_id,operation,key_digest),
 CHECK(response_cache IS NULL OR octet_length(response_cache::text)<=65536)
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, correlation_id uuid NOT NULL, entity_kind varchar(80) NOT NULL, entity_id uuid,
 event_code varchar(80) NOT NULL, limited_metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
-- Read-time dependency gate: historical proofs remain immutable. Conservative full
-- revision invalidation is deliberate; no old-edge reuse or teaching policy here.
CREATE VIEW current_verification_runs AS
 SELECT r.* FROM verification_runs r JOIN attempts a ON a.id=r.attempt_id
 JOIN step_versions tv ON tv.id=r.to_step_version_id
 JOIN step_slots ts ON ts.id=tv.step_slot_id
 LEFT JOIN step_versions fv ON fv.id=r.from_step_version_id
 LEFT JOIN step_slots fs ON fs.id=fv.step_slot_id
 WHERE a.revision=r.attempt_revision_requested AND a.problem_revision_id=r.problem_revision_id
 AND a.notation_profile=r.notation_profile_version AND ts.attempt_id=a.id AND ts.is_active AND ts.current_version=tv.version_number
 AND (r.from_kind='problem' OR (fs.attempt_id=a.id AND fs.is_active AND fs.current_version=fv.version_number));
CREATE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable history'; END $$;
CREATE TRIGGER immutable_step_versions BEFORE UPDATE OR DELETE ON step_versions FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_verification_results BEFORE UPDATE OR DELETE ON verification_results FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE FUNCTION enforce_data_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid boolean;
BEGIN
 IF TG_TABLE_NAME='problem_skills' THEN
  SELECT p.release_id=s.release_id INTO valid FROM problem_revisions p,skills s WHERE p.id=NEW.problem_revision_id AND s.id=NEW.skill_id;
 ELSIF TG_TABLE_NAME='skill_prerequisites' THEN
  SELECT s.release_id=p.release_id INTO valid FROM skills s,skills p WHERE s.id=NEW.skill_id AND p.id=NEW.prerequisite_skill_id;
 ELSIF TG_TABLE_NAME='attempts' THEN
  SELECT l.release_id=p.release_id AND NEW.notation_profile=p.notation_profile INTO valid FROM learning_sessions l,problem_revisions p WHERE l.id=NEW.learning_session_id AND p.id=NEW.problem_revision_id;
 ELSIF TG_TABLE_NAME='verification_runs' THEN
  SELECT a.problem_revision_id=NEW.problem_revision_id AND a.notation_profile=NEW.notation_profile_version
   AND ts.attempt_id=a.id AND (NEW.from_kind='problem' OR fs.attempt_id=a.id)
   INTO valid FROM attempts a JOIN step_versions tv ON tv.id=NEW.to_step_version_id JOIN step_slots ts ON ts.id=tv.step_slot_id
   LEFT JOIN step_versions fv ON fv.id=NEW.from_step_version_id LEFT JOIN step_slots fs ON fs.id=fv.step_slot_id WHERE a.id=NEW.attempt_id;
 END IF;
 IF valid IS DISTINCT FROM true THEN RAISE EXCEPTION 'invalid data scope'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER problem_skill_scope BEFORE INSERT OR UPDATE ON problem_skills FOR EACH ROW EXECUTE FUNCTION enforce_data_scope();
CREATE TRIGGER prerequisite_scope BEFORE INSERT OR UPDATE ON skill_prerequisites FOR EACH ROW EXECUTE FUNCTION enforce_data_scope();
CREATE TRIGGER attempt_scope BEFORE INSERT OR UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION enforce_data_scope();
CREATE TRIGGER verification_scope BEFORE INSERT OR UPDATE ON verification_runs FOR EACH ROW EXECUTE FUNCTION enforce_data_scope();
CREATE FUNCTION immutable_published_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='content_releases' THEN
  IF OLD.status IN ('published','retired') AND (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'published release immutable'; END IF;
  IF OLD.status IN ('published','retired') AND NEW.status NOT IN ('published','retired') THEN RAISE EXCEPTION 'published release immutable'; END IF;
 ELSE
  IF (OLD.review_status IN ('published','retired') OR EXISTS(SELECT 1 FROM attempts WHERE problem_revision_id=OLD.id))
   AND (to_jsonb(NEW)-'review_status') IS DISTINCT FROM (to_jsonb(OLD)-'review_status') THEN RAISE EXCEPTION 'published problem immutable'; END IF;
  IF OLD.review_status IN ('published','retired') AND NEW.review_status NOT IN ('published','retired') THEN RAISE EXCEPTION 'published problem immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER release_immutable BEFORE UPDATE ON content_releases FOR EACH ROW EXECUTE FUNCTION immutable_published_content();
CREATE TRIGGER problem_immutable BEFORE UPDATE ON problem_revisions FOR EACH ROW EXECUTE FUNCTION immutable_published_content();
