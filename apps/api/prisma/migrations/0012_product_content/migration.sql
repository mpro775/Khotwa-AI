-- Post-hackathon content revisions and subject evidence. Review before deployment.
CREATE TABLE studio_items (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE,
  subject_code text NOT NULL CHECK(subject_code IN ('algebra','physics','programming')),
  unit_code text NOT NULL, lesson_code text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE studio_revisions (
  id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES studio_items(id),
  version integer NOT NULL CHECK(version>0), edit_revision integer NOT NULL DEFAULT 0 CHECK(edit_revision>=0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_review','approved','published','archived')),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), content_hash text NOT NULL,
  validation jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL, published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, published_at timestamptz,
  UNIQUE(item_id,version), CHECK(status NOT IN ('approved','published') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX studio_one_published ON studio_revisions(item_id) WHERE status='published';
CREATE INDEX studio_status ON studio_revisions(status,item_id);
CREATE TABLE studio_events (
  id uuid PRIMARY KEY, revision_id uuid NOT NULL REFERENCES studio_revisions(id),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL,
  content_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product_mutations (
  id uuid PRIMARY KEY, owner_key text NOT NULL, operation text NOT NULL, key_digest text NOT NULL,
  fingerprint text NOT NULL, response_cache jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  UNIQUE(owner_key,operation,key_digest)
);
CREATE INDEX product_mutation_expiry ON product_mutations(expires_at);
CREATE TABLE subject_attempts (
  id uuid PRIMARY KEY, owner_key text NOT NULL,
  subject_code text NOT NULL CHECK(subject_code IN ('physics','programming')),
  problem_revision_id uuid NOT NULL REFERENCES studio_revisions(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  source_raw text NOT NULL CHECK(octet_length(source_raw)<=49152), answer_json jsonb NOT NULL,
  verdict jsonb NOT NULL, assistance_level integer NOT NULL DEFAULT 0 CHECK(assistance_level BETWEEN 0 AND 4),
  independent boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subject_attempt_owner ON subject_attempts(owner_key,created_at DESC,id);
CREATE TABLE subject_attempt_events (
  id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES subject_attempts(id) ON DELETE CASCADE,
  revision integer NOT NULL, event_kind text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Existing P0 records are materialized only for algebra studio publications.
CREATE TABLE studio_algebra_links (
  studio_revision_id uuid PRIMARY KEY REFERENCES studio_revisions(id),
  problem_revision_id uuid NOT NULL UNIQUE REFERENCES problem_revisions(id),
  problem_id uuid NOT NULL REFERENCES problems(id), release_id uuid NOT NULL REFERENCES content_releases(id)
);
