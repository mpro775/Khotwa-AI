-- Prisma requires an explicit composite unique key for the deferred 1:1
-- current-version relation, even though id alone is already the primary key.
ALTER TABLE step_slots ADD CONSTRAINT slot_current_version_key UNIQUE(id,current_version);
CREATE UNIQUE INDEX problem_edge_request_key ON verification_runs(attempt_id,request_key_hash,to_step_version_id) WHERE from_kind='problem';
