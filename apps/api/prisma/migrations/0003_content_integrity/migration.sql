ALTER TABLE skills ADD CONSTRAINT p0_skill_code CHECK(skill_code IN ('SK-ALG-01','SK-ALG-02','SK-ALG-03','SK-ALG-04','SK-ALG-05','SK-ALG-06','SK-ALG-07','SK-ALG-08'));
CREATE FUNCTION protect_content_membership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE release uuid; next_release uuid;
BEGIN
 IF TG_TABLE_NAME='skills' THEN
  IF TG_OP='INSERT' THEN release=NEW.release_id; ELSE release=OLD.release_id; END IF;
 ELSIF TG_TABLE_NAME='skill_prerequisites' THEN
  IF TG_OP='INSERT' THEN SELECT release_id INTO release FROM skills WHERE id=NEW.skill_id;
  ELSE SELECT release_id INTO release FROM skills WHERE id=OLD.skill_id; END IF;
 ELSIF TG_TABLE_NAME='problem_skills' THEN
  IF TG_OP='INSERT' THEN SELECT release_id INTO release FROM problem_revisions WHERE id=NEW.problem_revision_id;
  ELSE SELECT release_id INTO release FROM problem_revisions WHERE id=OLD.problem_revision_id; END IF;
 ELSE release=NEW.release_id;
 END IF;
 next_release=release;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='skills' THEN next_release=NEW.release_id;
  ELSIF TG_TABLE_NAME='skill_prerequisites' THEN SELECT release_id INTO next_release FROM skills WHERE id=NEW.skill_id;
  ELSIF TG_TABLE_NAME='problem_skills' THEN SELECT release_id INTO next_release FROM problem_revisions WHERE id=NEW.problem_revision_id;
  END IF;
 END IF;
 PERFORM 1 FROM content_releases WHERE id IN (release,next_release) ORDER BY id FOR SHARE;
 IF EXISTS(SELECT 1 FROM content_releases WHERE id IN (release,next_release) AND status IN ('published','retired')) THEN RAISE EXCEPTION 'published membership immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER frozen_skills BEFORE INSERT OR UPDATE OR DELETE ON skills FOR EACH ROW EXECUTE FUNCTION protect_content_membership();
CREATE TRIGGER frozen_prerequisites BEFORE INSERT OR UPDATE OR DELETE ON skill_prerequisites FOR EACH ROW EXECUTE FUNCTION protect_content_membership();
CREATE TRIGGER frozen_problem_skills BEFORE INSERT OR UPDATE OR DELETE ON problem_skills FOR EACH ROW EXECUTE FUNCTION protect_content_membership();
CREATE TRIGGER frozen_revision_membership BEFORE INSERT ON problem_revisions FOR EACH ROW EXECUTE FUNCTION protect_content_membership();
CREATE FUNCTION validate_content_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE has_cycle boolean;
BEGIN
 IF NEW.status='published' AND OLD.status<>'published' THEN
  WITH RECURSIVE walk(skill_id,ancestor,path,cycle) AS (
   SELECT p.skill_id,p.prerequisite_skill_id,ARRAY[p.skill_id,p.prerequisite_skill_id],false
   FROM skill_prerequisites p JOIN skills s ON s.id=p.skill_id WHERE s.release_id=NEW.id
   UNION ALL SELECT w.skill_id,p.prerequisite_skill_id,w.path||p.prerequisite_skill_id,p.prerequisite_skill_id=ANY(w.path)
   FROM walk w JOIN skill_prerequisites p ON p.skill_id=w.ancestor WHERE NOT w.cycle
  ) SELECT EXISTS(SELECT 1 FROM walk WHERE cycle) INTO has_cycle;
  IF has_cycle THEN RAISE EXCEPTION 'cyclic skill graph'; END IF;
  IF EXISTS(SELECT 1 FROM problem_revisions r WHERE r.release_id=NEW.id AND r.review_status='published'
   AND (r.notation_profile<>NEW.notation_profile OR r.original_equation_raw IS NULL OR NOT EXISTS(
    SELECT 1 FROM problem_skills ps WHERE ps.problem_revision_id=r.id AND ps.coverage_kind='primary')))
   THEN RAISE EXCEPTION 'incomplete published problem'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER publication_integrity BEFORE UPDATE ON content_releases FOR EACH ROW EXECUTE FUNCTION validate_content_publication();
ALTER TABLE step_versions ADD CONSTRAINT no_self_supersession CHECK(supersedes_step_version_id IS NULL OR supersedes_step_version_id<>id);
CREATE FUNCTION enforce_step_successor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version_number=1 THEN
  IF NEW.supersedes_step_version_id IS NOT NULL THEN RAISE EXCEPTION 'first version has no predecessor'; END IF;
 ELSIF NOT EXISTS(SELECT 1 FROM step_versions WHERE id=NEW.supersedes_step_version_id AND step_slot_id=NEW.step_slot_id AND version_number=NEW.version_number-1) THEN
  RAISE EXCEPTION 'version predecessor mismatch';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER version_successor BEFORE INSERT ON step_versions FOR EACH ROW EXECUTE FUNCTION enforce_step_successor();
