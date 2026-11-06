ALTER TABLE problem_revisions ADD COLUMN learning_family varchar(100);
CREATE TABLE content_pairings (
 id uuid PRIMARY KEY, release_id uuid NOT NULL REFERENCES content_releases(id), skill_id uuid NOT NULL REFERENCES skills(id),
 root_problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id), remediation_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 transfer_revision_id uuid NOT NULL REFERENCES problem_revisions(id), version varchar(80) NOT NULL,
 transfer_contrast varchar(200) NOT NULL CHECK(length(transfer_contrast)>5),
 math_checks jsonb NOT NULL CHECK(jsonb_typeof(math_checks)='object'),
 review_status text NOT NULL CHECK(review_status IN ('draft','reviewed')), reviewed_by_role text, reviewed_at timestamptz,
 enabled boolean NOT NULL DEFAULT false, is_synthetic boolean NOT NULL DEFAULT false,
 CHECK(root_problem_revision_id<>remediation_revision_id AND root_problem_revision_id<>transfer_revision_id AND remediation_revision_id<>transfer_revision_id),
 CHECK(review_status<>'reviewed' OR (reviewed_by_role IS NOT NULL AND reviewed_at IS NOT NULL)),
 UNIQUE(root_problem_revision_id,remediation_revision_id,transfer_revision_id,version)
);
CREATE FUNCTION validate_learning_pairing() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'enabled') IS DISTINCT FROM (to_jsonb(OLD)-'enabled') THEN RAISE EXCEPTION 'pairing content immutable'; END IF;
  RETURN NEW;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM problem_revisions root,problem_revisions rem,problem_revisions tr,skills s
  WHERE root.id=NEW.root_problem_revision_id AND rem.id=NEW.remediation_revision_id AND tr.id=NEW.transfer_revision_id AND s.id=NEW.skill_id
  AND root.release_id=NEW.release_id AND rem.release_id=NEW.release_id AND tr.release_id=NEW.release_id AND s.release_id=NEW.release_id
  AND rem.item_kind='remediation' AND tr.item_kind='transfer' AND rem.difficulty_band<=root.difficulty_band
  AND root.notation_profile=rem.notation_profile AND rem.notation_profile=tr.notation_profile
  AND root.learning_family IS NOT NULL AND rem.learning_family IS NOT NULL AND tr.learning_family IS NOT NULL
  AND tr.learning_family<>root.learning_family AND tr.learning_family<>rem.learning_family
  AND EXISTS(SELECT 1 FROM problem_skills WHERE problem_revision_id=root.id AND skill_id=s.id)
  AND EXISTS(SELECT 1 FROM problem_skills WHERE problem_revision_id=rem.id AND skill_id=s.id AND coverage_kind='primary')
  AND EXISTS(SELECT 1 FROM problem_skills WHERE problem_revision_id=tr.id AND skill_id=s.id AND coverage_kind='primary'))
 THEN RAISE EXCEPTION 'invalid learning pairing scope'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pairing_scope BEFORE INSERT OR UPDATE ON content_pairings FOR EACH ROW EXECUTE FUNCTION validate_learning_pairing();
CREATE TABLE learning_episodes (
 id uuid PRIMARY KEY,root_attempt_id uuid NOT NULL REFERENCES attempts(id),root_revision bigint NOT NULL CHECK(root_revision>=0),
 skill_id uuid NOT NULL REFERENCES skills(id),release_id uuid NOT NULL REFERENCES content_releases(id),
 policy_version varchar(80) NOT NULL,state text NOT NULL CHECK(state IN ('proposed','probing','remediating','awaiting_transfer','finished','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz,is_synthetic boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX one_active_episode ON learning_episodes(root_attempt_id) WHERE state NOT IN ('finished','cancelled');
CREATE TABLE learning_assignments (
 id uuid PRIMARY KEY,episode_id uuid NOT NULL REFERENCES learning_episodes(id),pairing_id uuid NOT NULL REFERENCES content_pairings(id),
 phase text NOT NULL CHECK(phase IN ('remediation','transfer')),problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 attempt_id uuid UNIQUE REFERENCES attempts(id),assignment_order int NOT NULL CHECK(assignment_order>0),
 assistance_policy text NOT NULL CHECK(assistance_policy IN ('guided','limited','independent')),
 measurement_exited_at timestamptz,invalidated_at timestamptz,assigned_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 UNIQUE(episode_id,phase,assignment_order),UNIQUE(episode_id,problem_revision_id),
 CHECK(phase<>'transfer' OR assistance_policy='independent' OR measurement_exited_at IS NOT NULL)
);
CREATE TABLE content_exposures (
 id uuid PRIMARY KEY,guest_session_id uuid NOT NULL REFERENCES guest_sessions(id),problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 learning_family varchar(100) NOT NULL,equation_hash varchar(64) NOT NULL,exposure_kind varchar(40) NOT NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(),UNIQUE(guest_session_id,problem_revision_id)
);
CREATE INDEX exposure_family ON content_exposures(guest_session_id,learning_family);
CREATE INDEX exposure_equation ON content_exposures(guest_session_id,equation_hash);
CREATE TABLE skill_evidence (
 id uuid PRIMARY KEY,learning_session_id uuid NOT NULL REFERENCES learning_sessions(id),skill_id uuid NOT NULL REFERENCES skills(id),
 attempt_id uuid NOT NULL REFERENCES attempts(id),attempt_revision bigint NOT NULL,problem_revision_id uuid NOT NULL REFERENCES problem_revisions(id),
 report_id uuid NOT NULL REFERENCES verification_reports(id),assignment_id uuid NOT NULL REFERENCES learning_assignments(id),
 event_kind text NOT NULL CHECK(event_kind IN ('guided_practice','transfer_observation')),
 observation text NOT NULL CHECK(observation IN ('positive','needs_review','assisted','non_assessable')),
 assistance_snapshot jsonb NOT NULL CHECK(jsonb_typeof(assistance_snapshot)='object'),assistance_revision int NOT NULL,
 policy_version varchar(80) NOT NULL,content_release_id uuid NOT NULL REFERENCES content_releases(id),
 dedup_key varchar(200) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(learning_session_id,dedup_key)
);
CREATE TRIGGER immutable_skill_evidence BEFORE UPDATE OR DELETE ON skill_evidence FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_exposure BEFORE UPDATE OR DELETE ON content_exposures FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE FUNCTION validate_learning_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='learning_episodes' THEN
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['state','ended_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','ended_at']) OR (OLD.state='cancelled' AND NEW.state<>'cancelled')) THEN RAISE EXCEPTION 'episode source immutable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id JOIN skills s ON s.id=NEW.skill_id
   WHERE a.id=NEW.root_attempt_id AND a.attempt_kind='main' AND a.revision=NEW.root_revision AND l.release_id=NEW.release_id AND s.release_id=l.release_id AND l.is_synthetic=NEW.is_synthetic)
   AND TG_OP='INSERT' THEN RAISE EXCEPTION 'episode scope mismatch'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM learning_episodes e JOIN attempts root ON root.id=e.root_attempt_id JOIN content_pairings p ON p.id=NEW.pairing_id
   WHERE e.id=NEW.episode_id AND p.root_problem_revision_id=root.problem_revision_id AND p.skill_id=e.skill_id AND p.release_id=e.release_id
   AND NEW.problem_revision_id=CASE WHEN NEW.phase='remediation' THEN p.remediation_revision_id ELSE p.transfer_revision_id END
   AND (NEW.attempt_id IS NULL OR EXISTS(SELECT 1 FROM attempts a WHERE a.id=NEW.attempt_id AND a.learning_session_id=root.learning_session_id AND a.problem_revision_id=NEW.problem_revision_id AND a.attempt_kind=NEW.phase)))
   THEN RAISE EXCEPTION 'assignment scope mismatch'; END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['attempt_id','assistance_policy','measurement_exited_at','invalidated_at','completed_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['attempt_id','assistance_policy','measurement_exited_at','invalidated_at','completed_at']) OR
    (OLD.attempt_id IS NOT NULL AND NEW.attempt_id IS DISTINCT FROM OLD.attempt_id) OR
    (OLD.measurement_exited_at IS NOT NULL AND NEW.measurement_exited_at IS DISTINCT FROM OLD.measurement_exited_at) OR
    (OLD.invalidated_at IS NOT NULL AND NEW.invalidated_at IS DISTINCT FROM OLD.invalidated_at) OR
    (OLD.assistance_policy<>'independent' AND NEW.assistance_policy='independent')) THEN RAISE EXCEPTION 'assignment history cannot be reset'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER episode_scope BEFORE INSERT OR UPDATE ON learning_episodes FOR EACH ROW EXECUTE FUNCTION validate_learning_scope();
CREATE TRIGGER assignment_scope BEFORE INSERT OR UPDATE ON learning_assignments FOR EACH ROW EXECUTE FUNCTION validate_learning_scope();
CREATE FUNCTION invalidate_learning_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.revision<>OLD.revision THEN
  UPDATE learning_assignments SET invalidated_at=COALESCE(invalidated_at,now()) WHERE episode_id IN (SELECT id FROM learning_episodes WHERE root_attempt_id=NEW.id);
  UPDATE learning_episodes SET state='cancelled',ended_at=now() WHERE root_attempt_id=NEW.id AND state<>'cancelled';
  IF NEW.attempt_kind='remediation' THEN
   UPDATE learning_assignments SET invalidated_at=COALESCE(invalidated_at,now()) WHERE phase='transfer' AND episode_id IN (SELECT episode_id FROM learning_assignments WHERE attempt_id=NEW.id);
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_revision_changed AFTER UPDATE OF revision ON attempts FOR EACH ROW EXECUTE FUNCTION invalidate_learning_revision();
CREATE FUNCTION validate_skill_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM attempts a JOIN learning_assignments x ON x.attempt_id=a.id JOIN learning_episodes e ON e.id=x.episode_id JOIN verification_reports r ON r.id=NEW.report_id
  WHERE a.id=NEW.attempt_id AND a.learning_session_id=NEW.learning_session_id AND a.revision=NEW.attempt_revision AND a.problem_revision_id=NEW.problem_revision_id
  AND x.id=NEW.assignment_id AND e.skill_id=NEW.skill_id AND e.release_id=NEW.content_release_id AND r.attempt_id=a.id AND r.attempt_revision=a.revision
  AND r.scope='current_sequence' AND r.dispatch_status='finished' AND r.report_json->>'isCurrent'='true' AND x.invalidated_at IS NULL
  AND a.assistance_revision=NEW.assistance_revision AND root_revision=(SELECT revision FROM attempts WHERE id=e.root_attempt_id) AND e.state<>'cancelled'
  AND NEW.event_kind=CASE WHEN x.phase='transfer' THEN 'transfer_observation' ELSE 'guided_practice' END
  AND NEW.policy_version=e.policy_version AND r.problem_revision_id=a.problem_revision_id
  AND NEW.assistance_snapshot->>'highestHintLevelSeen'='H'||a.highest_hint_level_seen::text
  AND (NEW.assistance_snapshot->>'fullSolutionSeen')::boolean=a.full_solution_seen
  AND (NEW.observation<>'positive' OR (jsonb_array_length(r.report_json->'transitions')>0 AND (r.report_json->'completion'->>'canMarkAttemptCompleted')::boolean AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.report_json->'transitions') v WHERE v->>'mathStatus'<>'verified_valid')
   AND a.independent_evidence_eligible AND NOT a.full_solution_seen AND a.highest_hint_level_seen=0 AND x.phase='transfer' AND x.assistance_policy='independent' AND x.measurement_exited_at IS NULL)))
 THEN RAISE EXCEPTION 'evidence source mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_scope BEFORE INSERT ON skill_evidence FOR EACH ROW EXECUTE FUNCTION validate_skill_evidence();
-- A later disclosure also invalidates positive measurement, even without a new verification request.
CREATE FUNCTION transfer_content_unexposed(target uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(
  SELECT 1 FROM attempts other JOIN learning_sessions ol ON ol.id=other.learning_session_id JOIN problem_revisions op ON op.id=other.problem_revision_id
  WHERE ol.guest_session_id=l.guest_session_id AND other.id<>a.id AND
   (op.problem_id=p.problem_id OR op.learning_family=p.learning_family OR regexp_replace(op.original_equation_raw,'[[:space:]]','','g')=regexp_replace(p.original_equation_raw,'[[:space:]]','','g'))
 ) AND NOT EXISTS(
  SELECT 1 FROM tutoring_events t JOIN attempts ta ON ta.id=t.attempt_id JOIN learning_sessions tl ON tl.id=ta.learning_session_id
  WHERE tl.guest_session_id=l.guest_session_id AND strpos(regexp_replace(t.public_json::text,'[[:space:]]','','g'),regexp_replace(p.original_equation_raw,'[[:space:]]','','g'))>0
 ) AND NOT EXISTS(
  SELECT 1 FROM diagnostic_probes d JOIN diagnoses dg ON dg.id=d.diagnosis_id JOIN attempts da ON da.id=dg.attempt_id JOIN learning_sessions dl ON dl.id=da.learning_session_id
  WHERE dl.guest_session_id=l.guest_session_id AND strpos(regexp_replace(d.public_json::text,'[[:space:]]','','g'),regexp_replace(p.original_equation_raw,'[[:space:]]','','g'))>0
 ) FROM attempts a JOIN learning_sessions l ON l.id=a.learning_session_id JOIN problem_revisions p ON p.id=a.problem_revision_id WHERE a.id=target
$$;
