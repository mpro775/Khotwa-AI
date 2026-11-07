-- Physics learning loop. Source-only migration; no publication or seed.
CREATE TABLE physics_learning_episodes (
 id uuid PRIMARY KEY, owner_key text NOT NULL, origin_owner_key text NOT NULL,
 root_attempt_id uuid NOT NULL REFERENCES subject_attempts(id) ON DELETE CASCADE,
 root_revision integer NOT NULL CHECK(root_revision>=0),
 state text NOT NULL CHECK(state IN ('remediating','awaiting_transfer','finished','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz
);
CREATE UNIQUE INDEX physics_one_active_loop ON physics_learning_episodes(root_attempt_id) WHERE state NOT IN ('finished','cancelled');
CREATE TABLE physics_learning_assignments (
 id uuid PRIMARY KEY, episode_id uuid NOT NULL REFERENCES physics_learning_episodes(id) ON DELETE CASCADE,
 phase text NOT NULL CHECK(phase IN ('remediation','transfer')),
 problem_revision_id uuid NOT NULL REFERENCES studio_revisions(id),
 attempt_id uuid NOT NULL UNIQUE REFERENCES subject_attempts(id) ON DELETE CASCADE,
 assigned_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, invalidated_at timestamptz,
 UNIQUE(episode_id,phase), UNIQUE(episode_id,problem_revision_id)
);
CREATE TABLE physics_content_exposures (
 id uuid PRIMARY KEY, owner_key text NOT NULL, origin_owner_key text NOT NULL,
 problem_revision_id uuid NOT NULL REFERENCES studio_revisions(id), family_code text NOT NULL,
 context_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_key,problem_revision_id)
);
CREATE INDEX physics_exposure_identity ON physics_content_exposures(owner_key,family_code,context_key);
GRANT SELECT,DELETE ON physics_learning_episodes,physics_learning_assignments,physics_content_exposures TO khotwa_retention_executor;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.purge_expired_guests(boolean,integer)'::regprocedure) INTO definition;
 IF position('DELETE FROM public.subject_attempts' IN definition)=0 THEN RAISE EXCEPTION 'retention baseline differs'; END IF;
 definition:=replace(definition,'DELETE FROM public.subject_attempts',
 'DELETE FROM public.physics_content_exposures WHERE owner_key=ANY(owner_keys); DELETE FROM public.physics_learning_episodes WHERE owner_key=ANY(owner_keys); DELETE FROM public.subject_attempts');
 EXECUTE definition;
END $migration$;
