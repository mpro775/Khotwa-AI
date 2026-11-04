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
