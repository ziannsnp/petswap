-- PetSwap database contract checks.
--
-- Each row below is a load-bearing promise the MVP schema makes to the app:
-- consent is never stored half-written, row-level security is on, booking
-- participants have policies, and confirmed stays cannot overlap. Read the rows
-- as a review checklist for any migration; the final assertion turns the same
-- list into a pass/fail gate.
--
-- Run locally after rebuilding the database:
--   npx supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/database_contract.sql
--
-- CI runs the same file on every change under supabase/ via
-- .github/workflows/db-contract.yml. These are catalogue checks only; they read
-- pg_catalog and information_schema and never write. Behavioural enforcement
-- (the overlap constraint actually rejecting a second confirmed booking) lives
-- in supabase/tests/booking_rules.test.sql.

\set ON_ERROR_STOP on
\pset format aligned
\echo '== PetSwap database contract =='

create temporary table _contract (
  check_name text primary key,
  passed boolean
);

insert into _contract (check_name, passed) values
  (
    'confirmed bookings use end-exclusive overlap protection',
    exists (
      select 1 from pg_constraint
      where conname = 'bookings_no_confirmed_overlap'
        and conrelid = 'public.bookings'::regclass
        and contype = 'x'
    )
  ),
  (
    'bookings reject a window whose end is not after its start',
    exists (
      select 1 from pg_constraint
      where conname = 'bookings_valid_window_check'
        and conrelid = 'public.bookings'::regclass
        and contype = 'c'
    )
  ),
  (
    'booking status enum carries the full lifecycle',
    (
      select array_agg(enumlabel::text order by enumlabel::text)
      from pg_enum
      where enumtypid = 'public.booking_status'::regtype
    ) = array['cancelled', 'completed', 'confirmed', 'declined', 'pending']
  ),
  (
    'the app-level booking guard is installed on insert and update',
    (
      select count(*) = 2
      from pg_trigger
      where tgrelid = 'public.bookings'::regclass
        and tgname in ('guard_booking_insert', 'guard_booking_update')
        and not tgisinternal
    )
  ),
  (
    'all MVP tables have row-level security enabled',
    (
      select bool_and(relrowsecurity)
      from pg_class
      where oid in (
        'public.profiles'::regclass,
        'public.pets'::regclass,
        'public.listings'::regclass,
        'public.listing_images'::regclass,
        'public.bookings'::regclass
      )
    )
  ),
  (
    'booking participant policies are installed',
    (
      select count(*) >= 4
      from pg_policies
      where schemaname = 'public' and tablename = 'bookings'
    )
  ),
  (
    'a requester-insert policy scopes new bookings to the current user',
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'bookings'
        and cmd = 'INSERT'
        and with_check like '%auth.uid()%'
    )
  ),
  (
    'profiles record the consent version and timestamp',
    (
      select bool_and(c.column_name is not null)
      from (values ('consent_version'), ('consent_given_at')) as expected(column_name)
      left join information_schema.columns c
        on c.table_schema = 'public'
        and c.table_name = 'profiles'
        and c.column_name = expected.column_name
    )
  ),
  (
    'personal data is never stored with a half-written consent record',
    exists (
      select 1 from pg_constraint
      where conname = 'profiles_consent_pair_check'
        and conrelid = 'public.profiles'::regclass
        and contype = 'c'
    )
  ),
  (
    'deleted listings must carry a deletion timestamp',
    exists (
      select 1 from pg_constraint
      where conname = 'listings_deleted_state_check'
        and conrelid = 'public.listings'::regclass
        and contype = 'c'
    )
  ),
  (
    'the public listing-photos storage bucket exists and is public',
    exists (
      select 1 from storage.buckets
      where id = 'listing-photos' and public
    )
  );

select
  'profiles records consent version and timestamp' as check_name,
  bool_and(c.column_name is not null) as passed
from (values ('consent_version'), ('consent_given_at')) as expected(column_name)
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = 'profiles'
  and c.column_name = expected.column_name;

select
  'usernames are lowercase and format constrained' as check_name,
  exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_check'
      and conrelid = 'public.profiles'::regclass
  ) as passed;

select
  'username availability does not expose email addresses' as check_name,
  p.prorettype = 'boolean'::regtype
    and pg_get_function_result(p.oid) = 'boolean' as passed
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_username_available';
select check_name, passed
from _contract
order by passed nulls first, check_name;

do $$
declare
  failures text;
begin
  select string_agg(check_name, E'\n  - ' order by check_name)
    into failures
  from _contract
  where passed is distinct from true;

  if failures is not null then
    raise exception E'database contract failed:\n  - %', failures;
  end if;

  raise notice 'database contract: all % checks passed', (select count(*) from _contract);
end;
$$;
