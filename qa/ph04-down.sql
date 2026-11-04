-- PH-07 delta rollback, isolated test database only.
DROP TABLE IF EXISTS tutoring_events;
DROP TABLE IF EXISTS hint_requests;
DROP TABLE IF EXISTS intervention_templates;
DROP TABLE IF EXISTS ai_budget_ledgers;
DROP FUNCTION IF EXISTS require_tutoring_context();
DROP FUNCTION IF EXISTS protect_intervention_template();
DROP TRIGGER IF EXISTS assistance_latch ON attempts;
DROP FUNCTION IF EXISTS protect_assistance_latch();
ALTER TABLE attempts DROP CONSTRAINT IF EXISTS assistance_independence;
ALTER TABLE attempts DROP CONSTRAINT IF EXISTS full_solution_level;
ALTER TABLE attempts DROP COLUMN IF EXISTS highest_hint_level_seen, DROP COLUMN IF EXISTS independent_evidence_eligible,
 DROP COLUMN IF EXISTS full_solution_seen, DROP COLUMN IF EXISTS assistance_revision;

-- Isolated-test rollback only. No deployed data is affected.
DROP VIEW IF EXISTS current_diagnoses;
DROP TABLE IF EXISTS probe_responses;
DROP TABLE IF EXISTS diagnostic_probes;
DROP TABLE IF EXISTS diagnoses;
DROP TABLE IF EXISTS diagnostic_templates;
DROP TABLE IF EXISTS misconception_catalog;
DROP FUNCTION IF EXISTS require_diagnosis_evidence();
DROP FUNCTION IF EXISTS protect_ph06_history();
DROP FUNCTION IF EXISTS protect_used_diagnostic_template();
DROP FUNCTION IF EXISTS diagnostic_catalog_skill_release();

-- Test-only down migration; runner asserts isolated hostname/database first.
-- Never execute against a deployed database or real learner data.
DROP VIEW current_verification_runs;
ALTER TABLE verification_runs DROP COLUMN report_id;
DROP TABLE verification_reports;
DROP FUNCTION protect_finished_report();
ALTER TABLE step_slots DROP CONSTRAINT current_version_exists;
DROP TABLE verification_results, verification_runs, parse_results, step_versions,
 step_slots, attempts, audit_events, idempotency_records, learning_sessions,
 guest_sessions, problem_skills, problem_revisions, problems, skill_prerequisites,
 skills, content_releases;
DROP FUNCTION immutable_published_content(), enforce_data_scope(), reject_history_change();
DROP FUNCTION protect_content_membership(), validate_content_publication();
DROP FUNCTION enforce_step_successor();
