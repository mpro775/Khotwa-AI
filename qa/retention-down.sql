-- Local rollback of 0010 executable surface; cannot restore purged data.
DROP FUNCTION public.purge_expired_guests(boolean,integer);
CREATE OR REPLACE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable history'; END $$;
CREATE OR REPLACE FUNCTION protect_ph06_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable diagnostic history'; END $$;
CREATE OR REPLACE FUNCTION protect_finished_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.dispatch_status='finished' THEN RAISE EXCEPTION 'immutable verification report'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
-- Retain NOLOGIN roles: other isolated databases may reference them.
