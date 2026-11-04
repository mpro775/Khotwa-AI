-- PH-05 groups existing edge proofs; no new public fields or math scope.
CREATE TABLE verification_reports (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES attempts(id),
 idempotency_record_id uuid NOT NULL REFERENCES idempotency_records(id),
 attempt_revision bigint NOT NULL CHECK(attempt_revision BETWEEN 0 AND 2147483647),
 problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 notation_profile varchar(80) NOT NULL, engine_version varchar(80) NOT NULL,
 scope text NOT NULL CHECK(scope IN ('target_edge','current_sequence')),
 target_step_id uuid REFERENCES step_slots(id), step_version_ids uuid[] NOT NULL,
 dispatch_status text NOT NULL CHECK(dispatch_status IN ('running','finished','failed')),
 report_json jsonb, final_result_json jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), deadline_at timestamptz NOT NULL, finished_at timestamptz,
 CHECK((scope='target_edge' AND target_step_id IS NOT NULL) OR (scope='current_sequence' AND target_step_id IS NULL)),
 CHECK(cardinality(step_version_ids)>0), CHECK(deadline_at>created_at),
 CHECK(report_json IS NULL OR octet_length(report_json::text)<=65536),
 CHECK((dispatch_status='finished')=(report_json IS NOT NULL))
);
CREATE UNIQUE INDEX active_verification_request ON verification_reports(idempotency_record_id) WHERE dispatch_status='running';
CREATE INDEX reports_by_attempt_revision ON verification_reports(attempt_id,attempt_revision,finished_at DESC);
ALTER TABLE verification_runs ADD COLUMN report_id uuid REFERENCES verification_reports(id);
CREATE INDEX edges_by_report ON verification_runs(report_id);
CREATE FUNCTION protect_finished_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.dispatch_status='finished' THEN RAISE EXCEPTION 'immutable verification report'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_finished_report BEFORE UPDATE OR DELETE ON verification_reports FOR EACH ROW EXECUTE FUNCTION protect_finished_report();
