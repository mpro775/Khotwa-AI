-- PH-07: structure only. No content/provider approval or seed is implied.
ALTER TABLE attempts ADD COLUMN highest_hint_level_seen smallint NOT NULL DEFAULT 0 CHECK(highest_hint_level_seen BETWEEN 0 AND 4);
ALTER TABLE attempts ADD COLUMN independent_evidence_eligible boolean NOT NULL DEFAULT true;
ALTER TABLE attempts ADD COLUMN full_solution_seen boolean NOT NULL DEFAULT false;
ALTER TABLE attempts ADD COLUMN assistance_revision integer NOT NULL DEFAULT 0 CHECK(assistance_revision>=0);
ALTER TABLE attempts ADD CONSTRAINT assistance_independence CHECK(NOT independent_evidence_eligible OR (highest_hint_level_seen=0 AND NOT full_solution_seen));
ALTER TABLE attempts ADD CONSTRAINT full_solution_level CHECK(NOT full_solution_seen OR highest_hint_level_seen=4);
CREATE FUNCTION protect_assistance_latch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.highest_hint_level_seen<OLD.highest_hint_level_seen OR NEW.assistance_revision<OLD.assistance_revision
 OR (NOT OLD.independent_evidence_eligible AND NEW.independent_evidence_eligible)
 OR (OLD.full_solution_seen AND NOT NEW.full_solution_seen) THEN RAISE EXCEPTION 'assistance history cannot be reset'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assistance_latch BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION protect_assistance_latch();
CREATE TABLE intervention_templates (
 id uuid PRIMARY KEY, release_id uuid NOT NULL REFERENCES content_releases(id),
 problem_revision_id uuid REFERENCES problem_revisions(id), error_code varchar(32) CHECK(error_code ~ '^ERR-ALG-0[1-6]$'),
 hint_level smallint NOT NULL CHECK(hint_level BETWEEN 1 AND 4),
 template_version varchar(80) NOT NULL, policy_version varchar(80) NOT NULL,
 text_ar text NOT NULL CHECK(char_length(text_ar) BETWEEN 1 AND 1200),
 allowed_rephrases jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(allowed_rephrases)='array' AND jsonb_array_length(allowed_rephrases)<=6),
 math_assertions jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(math_assertions)='array' AND jsonb_array_length(math_assertions)<=6),
 solution_steps jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(solution_steps)='array' AND jsonb_array_length(solution_steps)<=12),
 is_synthetic boolean NOT NULL DEFAULT false, enabled boolean NOT NULL DEFAULT false,
 review_status text NOT NULL CHECK(review_status IN ('draft','reviewed')), reviewed_by_role text, reviewed_at timestamptz,
 CHECK(review_status<>'reviewed' OR (reviewed_by_role IS NOT NULL AND reviewed_at IS NOT NULL)),
 CHECK((hint_level=4 AND problem_revision_id IS NOT NULL AND jsonb_array_length(solution_steps)>0) OR (hint_level<4 AND jsonb_array_length(solution_steps)=0)),
 CHECK(octet_length(allowed_rephrases::text)+octet_length(math_assertions::text)+octet_length(solution_steps::text)<=20000)
);
CREATE INDEX templates_by_release_level ON intervention_templates(release_id,hint_level,error_code);
CREATE TABLE hint_requests (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES attempts(id), attempt_revision bigint NOT NULL,
 problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 idempotency_record_id uuid NOT NULL REFERENCES idempotency_records(id),
 assistance_revision integer NOT NULL, anchor_step_version_id uuid REFERENCES step_versions(id),
 verification_result_id uuid REFERENCES verification_results(id), diagnosis_id uuid REFERENCES diagnoses(id),
 template_id uuid NOT NULL REFERENCES intervention_templates(id), hint_level smallint NOT NULL CHECK(hint_level BETWEEN 1 AND 4),
 policy_version varchar(80) NOT NULL, prompt_version varchar(80) NOT NULL, content_hash varchar(64) NOT NULL,
 context_key varchar(64) NOT NULL,
 ai_reserved boolean NOT NULL DEFAULT false, cost_units_reserved integer NOT NULL DEFAULT 0 CHECK(cost_units_reserved>=0),
 dispatch_status text NOT NULL CHECK(dispatch_status IN ('running','finished','failed')),
 outcome_code varchar(80), created_at timestamptz NOT NULL DEFAULT now(), deadline_at timestamptz NOT NULL, finished_at timestamptz,
 CHECK(deadline_at>created_at), CHECK(attempt_revision BETWEEN 0 AND 2147483647),
 CHECK(hint_level=4 OR (anchor_step_version_id IS NOT NULL AND verification_result_id IS NOT NULL))
);
CREATE UNIQUE INDEX active_hint_attempt ON hint_requests(attempt_id) WHERE dispatch_status='running';
CREATE UNIQUE INDEX active_hint_key ON hint_requests(idempotency_record_id) WHERE dispatch_status='running';
CREATE TABLE tutoring_events (
 id uuid PRIMARY KEY, hint_request_id uuid NOT NULL UNIQUE REFERENCES hint_requests(id),
 attempt_id uuid NOT NULL REFERENCES attempts(id), attempt_revision bigint NOT NULL,
 problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 anchor_step_version_id uuid REFERENCES step_versions(id), verification_result_id uuid REFERENCES verification_results(id),
 diagnosis_id uuid REFERENCES diagnoses(id), template_id uuid NOT NULL REFERENCES intervention_templates(id),
 event_type text NOT NULL CHECK(event_type IN ('hint','full_solution','fallback','pause')),
 hint_level smallint NOT NULL CHECK(hint_level BETWEEN 1 AND 4), policy_version varchar(80) NOT NULL,
 prompt_version varchar(80) NOT NULL, content_version varchar(80) NOT NULL,
 context_key varchar(64) NOT NULL,
 rendered_text_ar text NOT NULL, solution_steps jsonb NOT NULL,
 generation_source text NOT NULL CHECK(generation_source IN ('reviewed_template','llm_validated','manual')),
 independent_evidence_eligible boolean NOT NULL CHECK(NOT independent_evidence_eligible),
 public_json jsonb NOT NULL, math_proof_json jsonb NOT NULL, audit_json jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(public_json::text)<=30000 AND octet_length(audit_json::text)<=4000 AND octet_length(math_proof_json::text)<=30000),
 CHECK((hint_level=4 AND event_type='full_solution') OR (hint_level<4 AND event_type<>'full_solution'))
);
CREATE INDEX tutoring_context ON tutoring_events(attempt_id,attempt_revision,anchor_step_version_id,hint_level);
CREATE TRIGGER immutable_tutoring_event BEFORE UPDATE OR DELETE ON tutoring_events FOR EACH ROW EXECUTE FUNCTION protect_ph06_history();
CREATE TABLE ai_budget_ledgers (
 scope varchar(80) NOT NULL, day date NOT NULL, calls_reserved integer NOT NULL DEFAULT 0 CHECK(calls_reserved>=0),
 cost_units_reserved integer NOT NULL DEFAULT 0 CHECK(cost_units_reserved>=0),
 PRIMARY KEY(scope,day)
);
CREATE FUNCTION protect_intervention_template() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM hint_requests WHERE template_id=OLD.id) AND
 (TG_OP='DELETE' OR (to_jsonb(OLD)-'enabled') IS DISTINCT FROM (to_jsonb(NEW)-'enabled'))
 THEN RAISE EXCEPTION 'used hint template must be versioned'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER pinned_intervention_template BEFORE UPDATE OR DELETE ON intervention_templates FOR EACH ROW EXECUTE FUNCTION protect_intervention_template();
CREATE FUNCTION require_tutoring_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM attempts a WHERE a.id=NEW.attempt_id AND a.revision=NEW.attempt_revision AND a.problem_revision_id=NEW.problem_revision_id)
 THEN RAISE EXCEPTION 'tutoring requires current pinned attempt'; END IF;
 IF NEW.anchor_step_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM step_versions v JOIN step_slots s ON s.id=v.step_slot_id WHERE v.id=NEW.anchor_step_version_id AND s.attempt_id=NEW.attempt_id AND s.is_active AND s.current_version=v.version_number)
 THEN RAISE EXCEPTION 'tutoring anchor must be current and owned'; END IF;
 IF NEW.verification_result_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM verification_results v JOIN current_verification_runs r ON r.id=v.verification_run_id WHERE v.id=NEW.verification_result_id AND r.attempt_id=NEW.attempt_id AND r.attempt_revision_requested=NEW.attempt_revision AND r.to_step_version_id=NEW.anchor_step_version_id AND v.math_status IN ('verified_valid','verified_invalid'))
 THEN RAISE EXCEPTION 'tutoring requires current verified evidence'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hint_context BEFORE INSERT ON hint_requests FOR EACH ROW EXECUTE FUNCTION require_tutoring_context();
CREATE TRIGGER tutoring_context BEFORE INSERT ON tutoring_events FOR EACH ROW EXECUTE FUNCTION require_tutoring_context();
