CREATE FUNCTION protect_studio_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'content history is archived, never deleted'; END IF;
 IF OLD.status<>'draft' AND (
  NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.version IS DISTINCT FROM OLD.version OR
  NEW.payload IS DISTINCT FROM OLD.payload OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
 ) AND NOT (OLD.status='in_review' AND NEW.status='approved') THEN
  RAISE EXCEPTION 'reviewed content snapshot immutable';
 END IF;
 IF NEW.item_id<>OLD.item_id OR NEW.version<>OLD.version OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'content revision identity immutable';
 END IF;
 IF NOT (
  (OLD.status='draft' AND NEW.status IN ('draft','in_review','archived')) OR
  (OLD.status='in_review' AND NEW.status='approved') OR
  (OLD.status='approved' AND NEW.status='published') OR
  (OLD.status='published' AND NEW.status='archived') OR
  (OLD.status='archived' AND NEW.status='published') OR
  (OLD.status=NEW.status AND NEW.payload=OLD.payload AND NEW.content_hash=OLD.content_hash)
 ) THEN RAISE EXCEPTION 'invalid content lifecycle'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER studio_snapshot_immutable BEFORE UPDATE OR DELETE ON studio_revisions FOR EACH ROW EXECUTE FUNCTION protect_studio_snapshot();
CREATE TRIGGER studio_audit_immutable BEFORE UPDATE OR DELETE ON studio_events FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER subject_evidence_immutable BEFORE UPDATE OR DELETE ON subject_attempt_events FOR EACH ROW EXECUTE FUNCTION reject_history_change();
