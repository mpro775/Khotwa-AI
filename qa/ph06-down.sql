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
