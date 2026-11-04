-- PH-06: no content is inserted or approved by a migration.
CREATE TABLE misconception_catalog (
 id uuid PRIMARY KEY, release_id uuid NOT NULL REFERENCES content_releases(id),
 error_code varchar(32) NOT NULL CHECK(error_code ~ '^ERR-ALG-0[1-6]$'),
 skill_id uuid NOT NULL REFERENCES skills(id), catalog_version varchar(80) NOT NULL,
 enabled boolean NOT NULL DEFAULT false, is_synthetic boolean NOT NULL DEFAULT false,
 review_status text NOT NULL CHECK(review_status IN ('draft','reviewed')),
 reviewed_by_role text, reviewed_at timestamptz,
 UNIQUE(release_id,error_code),
 CHECK(review_status<>'reviewed' OR (reviewed_by_role IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE diagnostic_templates (
 id uuid PRIMARY KEY, release_id uuid NOT NULL REFERENCES content_releases(id),
 family varchar(80) NOT NULL, template_version varchar(80) NOT NULL,
 question_ar text NOT NULL CHECK(char_length(question_ar) BETWEEN 1 AND 1000),
 options_json jsonb NOT NULL CHECK(jsonb_typeof(options_json)='array' AND jsonb_array_length(options_json) BETWEEN 2 AND 6),
 rules_json jsonb NOT NULL CHECK(jsonb_typeof(rules_json)='object'),
 enabled boolean NOT NULL DEFAULT false, is_synthetic boolean NOT NULL DEFAULT false,
 review_status text NOT NULL CHECK(review_status IN ('draft','reviewed')),
 reviewed_by_role text, reviewed_at timestamptz,
 UNIQUE(release_id,family,template_version),
 CHECK(octet_length(options_json::text)+octet_length(rules_json::text)<=12000),
 CHECK(review_status<>'reviewed' OR (reviewed_by_role IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE diagnoses (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES attempts(id),
 verification_result_id uuid NOT NULL REFERENCES verification_results(id),
 attempt_revision bigint NOT NULL CHECK(attempt_revision BETWEEN 0 AND 2147483647),
 release_id uuid NOT NULL REFERENCES content_releases(id),
 template_id uuid REFERENCES diagnostic_templates(id),
 diagnosis_policy_version varchar(80) NOT NULL,
 candidate_json jsonb NOT NULL CHECK(jsonb_typeof(candidate_json)='object'),
 basis_json jsonb NOT NULL CHECK(jsonb_typeof(basis_json)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(verification_result_id,diagnosis_policy_version),
 UNIQUE(attempt_id,attempt_revision,diagnosis_policy_version),
 CHECK(octet_length(candidate_json::text)+octet_length(basis_json::text)<=20000)
);
CREATE INDEX diagnoses_attempt_revision ON diagnoses(attempt_id,attempt_revision);
CREATE TABLE diagnostic_probes (
 id uuid PRIMARY KEY, diagnosis_id uuid NOT NULL UNIQUE REFERENCES diagnoses(id),
 template_id uuid NOT NULL REFERENCES diagnostic_templates(id),
 public_json jsonb NOT NULL CHECK(jsonb_typeof(public_json)='object'),
 private_rules_json jsonb NOT NULL CHECK(jsonb_typeof(private_rules_json)='object'),
 template_version varchar(80) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(public_json::text)+octet_length(private_rules_json::text)<=20000)
);
CREATE TABLE probe_responses (
 id uuid PRIMARY KEY, probe_id uuid NOT NULL UNIQUE REFERENCES diagnostic_probes(id),
 response_raw jsonb NOT NULL CHECK(jsonb_typeof(response_raw)='object'),
 response_evaluation text NOT NULL CHECK(response_evaluation IN ('supported','not_supported','unclear','unverified')),
 result_json jsonb NOT NULL CHECK(jsonb_typeof(result_json)='object'),
 assistance_level varchar(2) NOT NULL CHECK(assistance_level='H0'),
 diagnosis_policy_version varchar(80) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(response_raw::text)<=8000 AND octet_length(result_json::text)<=12000)
);
CREATE FUNCTION require_diagnosis_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM verification_results v JOIN verification_runs r ON r.id=v.verification_run_id
 JOIN verification_reports p ON p.id=r.report_id JOIN attempts a ON a.id=r.attempt_id
 JOIN learning_sessions l ON l.id=a.learning_session_id
 WHERE v.id=NEW.verification_result_id AND v.math_status='verified_invalid'
 AND v.evidence_json IS NOT NULL AND v.evidence_json->'witness' IS NOT NULL
 AND r.attempt_id=NEW.attempt_id AND r.attempt_revision_requested=NEW.attempt_revision
 AND p.scope='current_sequence' AND l.release_id=NEW.release_id
 ) THEN RAISE EXCEPTION 'diagnosis requires pinned invalid-edge evidence'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER diagnosis_evidence BEFORE INSERT ON diagnoses FOR EACH ROW EXECUTE FUNCTION require_diagnosis_evidence();
CREATE FUNCTION protect_ph06_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable diagnostic history'; END $$;
CREATE TRIGGER immutable_diagnosis BEFORE UPDATE OR DELETE ON diagnoses FOR EACH ROW EXECUTE FUNCTION protect_ph06_history();
CREATE TRIGGER immutable_probe BEFORE UPDATE OR DELETE ON diagnostic_probes FOR EACH ROW EXECUTE FUNCTION protect_ph06_history();
CREATE TRIGGER immutable_probe_response BEFORE UPDATE OR DELETE ON probe_responses FOR EACH ROW EXECUTE FUNCTION protect_ph06_history();
CREATE VIEW current_diagnoses AS
 SELECT d.* FROM diagnoses d JOIN verification_results v ON v.id=d.verification_result_id
 JOIN current_verification_runs r ON r.id=v.verification_run_id
 JOIN verification_runs source_run ON source_run.id=r.id
 JOIN verification_reports p ON p.id=source_run.report_id
 WHERE p.dispatch_status='finished' AND p.scope='current_sequence' AND p.report_json->>'isCurrent'='true'
 AND (p.report_json->'transitions'->((p.report_json->>'firstBlockingTransitionIndex')::int)->>'verificationResultId')=v.id::text
 AND v.math_status='verified_invalid';
CREATE FUNCTION protect_used_diagnostic_template() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM diagnoses WHERE template_id=OLD.id) AND
 (TG_OP='DELETE' OR (to_jsonb(OLD)-'enabled') IS DISTINCT FROM (to_jsonb(NEW)-'enabled'))
 THEN RAISE EXCEPTION 'referenced diagnostic template must be versioned'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER pinned_diagnostic_template BEFORE UPDATE OR DELETE ON diagnostic_templates FOR EACH ROW EXECUTE FUNCTION protect_used_diagnostic_template();
CREATE FUNCTION diagnostic_catalog_skill_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM skills WHERE id=NEW.skill_id AND release_id=NEW.release_id)
 THEN RAISE EXCEPTION 'diagnostic skill must belong to the content release'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER catalog_skill_release BEFORE INSERT OR UPDATE ON misconception_catalog FOR EACH ROW EXECUTE FUNCTION diagnostic_catalog_skill_release();
