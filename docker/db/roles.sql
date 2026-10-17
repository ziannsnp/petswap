-- Runs once, when the database volume is first initialised. The Supabase
-- Postgres image creates these service roles without a usable password; give
-- them the one the other containers connect with.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
