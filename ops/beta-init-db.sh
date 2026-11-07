#!/bin/sh
set -eu
# Runs only on a NEW beta volume. Existing environments require reviewed role
# provisioning separately; this does not run a project migration or seed.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
  --set=app_password="$POSTGRES_APP_PASSWORD" --set=backup_password="$POSTGRES_BACKUP_PASSWORD" <<'SQL'
CREATE ROLE khotwa_beta_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'app_password';
CREATE ROLE khotwa_beta_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'backup_password';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE khotwa_beta TO khotwa_beta_app,khotwa_beta_backup;
GRANT USAGE ON SCHEMA public TO khotwa_beta_app,khotwa_beta_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO khotwa_beta_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO khotwa_beta_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
SQL
