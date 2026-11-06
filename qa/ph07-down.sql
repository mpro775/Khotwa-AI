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
