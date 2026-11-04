-- Read-only projection; immutable skill_evidence remains the source of truth.
CREATE VIEW current_skill_evidence AS
 SELECT DISTINCT ON(v.attempt_id,v.skill_id) v.* FROM skill_evidence v
 JOIN attempts a ON a.id=v.attempt_id
 JOIN learning_sessions l ON l.id=a.learning_session_id
 JOIN learning_assignments x ON x.id=v.assignment_id AND x.attempt_id=a.id
 JOIN learning_episodes e ON e.id=x.episode_id
 JOIN attempts root ON root.id=e.root_attempt_id
 JOIN content_pairings p ON p.id=x.pairing_id
 JOIN problem_revisions r ON r.id=a.problem_revision_id
 JOIN problems base ON base.id=r.problem_id
 JOIN problem_revisions rr ON rr.id=root.problem_revision_id
 JOIN problems rb ON rb.id=rr.problem_id
 JOIN content_releases c ON c.id=e.release_id
 JOIN skills s ON s.id=v.skill_id
 JOIN verification_reports report ON report.id=v.report_id
 WHERE v.attempt_revision=a.revision AND v.problem_revision_id=a.problem_revision_id
 AND v.assistance_revision=a.assistance_revision
 AND v.learning_session_id=a.learning_session_id AND v.content_release_id=l.release_id
 AND root.learning_session_id=a.learning_session_id AND root.revision=e.root_revision
 AND e.state<>'cancelled' AND x.invalidated_at IS NULL AND p.enabled
 AND p.math_checks->>'status'='verified_valid'
 AND r.review_status='published' AND rr.review_status='published' AND c.status='published'
 AND base.archived_at IS NULL AND rb.archived_at IS NULL AND s.status='active'
 AND s.release_id=c.id AND v.policy_version=e.policy_version
 AND report.attempt_id=a.id AND report.attempt_revision=a.revision
 AND report.problem_revision_id=a.problem_revision_id AND report.notation_profile=a.notation_profile
 AND report.engine_version='0.3.0' AND report.scope='current_sequence' AND report.dispatch_status='finished' AND report.report_json->>'isCurrent'='true'
 AND report.id=(SELECT id FROM verification_reports WHERE attempt_id=a.id AND attempt_revision=a.revision AND scope='current_sequence' AND dispatch_status='finished' AND report_json->>'isCurrent'='true' ORDER BY finished_at DESC,id DESC LIMIT 1)
 AND (v.observation<>'positive' OR v.event_kind<>'transfer_observation' OR
  (a.attempt_kind='transfer' AND x.phase='transfer' AND x.assistance_policy='independent'
   AND x.measurement_exited_at IS NULL AND a.independent_evidence_eligible
   AND NOT a.full_solution_seen AND a.highest_hint_level_seen=0
   AND transfer_content_unexposed(a.id)
   AND report.report_json->'completion'->>'canMarkAttemptCompleted'='true'
   AND jsonb_array_length(report.report_json->'transitions')>0
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report.report_json->'transitions') t WHERE t->>'mathStatus'<>'verified_valid')))
 ORDER BY v.attempt_id,v.skill_id,v.created_at DESC,v.id DESC;
