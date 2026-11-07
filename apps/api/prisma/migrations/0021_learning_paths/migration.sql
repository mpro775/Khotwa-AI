-- V2.2 content only. Apply to an isolated test database before runtime acceptance.
CREATE TABLE learning_content_items (
 id uuid PRIMARY KEY, code text NOT NULL UNIQUE,
 subject_code text NOT NULL CHECK(subject_code IN ('algebra','physics','programming')),
 kind text NOT NULL CHECK(kind IN ('track','lesson')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE learning_content_revisions (
 id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES learning_content_items(id),
 version integer NOT NULL CHECK(version>0), edit_revision integer NOT NULL DEFAULT 0 CHECK(edit_revision>=0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_review','approved','published','archived')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), content_hash text NOT NULL,
 validation jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL, published_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, published_at timestamptz,
 UNIQUE(item_id,version), CHECK(status NOT IN ('approved','published') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
 CHECK(status<>'published' OR (published_by IS NOT NULL AND published_at IS NOT NULL))
);
CREATE UNIQUE INDEX learning_content_one_published ON learning_content_revisions(item_id) WHERE status='published';
CREATE INDEX learning_content_catalog ON learning_content_revisions(status,(payload->>'subject'),(payload->>'kind'));
CREATE TABLE learning_content_events (
 id uuid PRIMARY KEY, revision_id uuid NOT NULL REFERENCES learning_content_revisions(id),
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL,
 content_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER learning_content_snapshot_immutable BEFORE UPDATE OR DELETE ON learning_content_revisions FOR EACH ROW EXECUTE FUNCTION protect_studio_snapshot();
CREATE TRIGGER learning_content_audit_immutable BEFORE UPDATE OR DELETE ON learning_content_events FOR EACH ROW EXECUTE FUNCTION reject_history_change();
