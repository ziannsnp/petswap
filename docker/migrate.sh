#!/bin/sh
# Entrypoint of the one-shot `migrate` service in docker-compose.yml.
#
# Applies every file in /migrations (supabase/migrations/) that this database has
# not recorded yet, in filename order, each in its own transaction. Versions are
# recorded in supabase_migrations.schema_migrations, the table the Supabase CLI
# uses, so re-running is a no-op and a later migration is picked up on the next
# `docker compose up`.
#
# The seed runs only when this run applied the first migration, i.e. the database
# was new, and only when SEED_DEMO_DATA=true. That matches `supabase db reset`:
# seed data belongs to a freshly built database, not to every restart.
set -eu

psql_quiet() {
  psql -v ON_ERROR_STOP=1 --quiet --no-psqlrc "$@"
}

psql_quiet <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

already_applied=$(psql_quiet -At -c 'select count(*) from supabase_migrations.schema_migrations')
applied_now=0

for file in /migrations/*.sql; do
  [ -e "$file" ] || { echo "migrate: no migrations found in /migrations" >&2; exit 1; }

  base=$(basename "$file" .sql)
  version=${base%%_*}
  name=${base#*_}

  case $version in
    *[!0-9]* | '') echo "migrate: $base.sql does not start with a numeric version" >&2; exit 1 ;;
  esac

  recorded=$(psql_quiet -At -c "select 1 from supabase_migrations.schema_migrations where version = '$version'")
  if [ -n "$recorded" ]; then
    continue
  fi

  echo "migrate: applying $base"
  psql_quiet --single-transaction \
    -f "$file" \
    -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
  applied_now=$((applied_now + 1))
done

if [ "$already_applied" -eq 0 ] && [ "$applied_now" -gt 0 ]; then
  if [ "$SEED_DEMO_DATA" = "true" ]; then
    echo "migrate: new database, loading seed.sql"
    psql_quiet --single-transaction -f /seed.sql
  else
    echo "migrate: new database, SEED_DEMO_DATA is not true so seed.sql was skipped"
  fi
fi

# PostgREST caches the schema; tell it to pick up what was just created.
psql_quiet -c "notify pgrst, 'reload schema'"

echo "migrate: done ($applied_now applied, $already_applied already recorded)"
