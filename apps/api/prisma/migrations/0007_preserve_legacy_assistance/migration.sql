-- A legacy assisted-completed marker is evidence of assistance, not of a
-- particular hint level. Preserve non-independence without inventing H4.
UPDATE attempts SET independent_evidence_eligible=false
WHERE status='assisted_completed' AND independent_evidence_eligible;
