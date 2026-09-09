-- Run after `npx supabase db reset`, then create/sign in local users through
-- Studio or app flows before testing RLS with authenticated JWTs.

begin;

create temporary table _contract (
  check_name text not null,
  passed boolean
) on commit drop;

insert into _contract (check_name, passed)
select
  'confirmed bookings use end-exclusive overlap protection' as check_name,
  exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_confirmed_overlap'
      and conrelid = 'public.bookings'::regclass
  ) as passed;

insert into _contract (check_name, passed)
select
  'all MVP tables have RLS enabled' as check_name,
  bool_and(relrowsecurity) as passed
from pg_class
where oid in (
  'public.profiles'::regclass,
  'public.pets'::regclass,
  'public.listings'::regclass,
  'public.listing_images'::regclass,
  'public.bookings'::regclass
);

insert into _contract (check_name, passed)
select
  'booking participant policies are installed' as check_name,
  count(*) >= 4 as passed
from pg_policies
where schemaname = 'public'
  and tablename = 'bookings';

insert into _contract (check_name, passed)
select
  'profiles records consent version and timestamp' as check_name,
  bool_and(c.column_name is not null) as passed
from (values ('consent_version'), ('consent_given_at')) as expected(column_name)
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = 'profiles'
  and c.column_name = expected.column_name;

insert into _contract (check_name, passed)
select
  'usernames are lowercase and format constrained' as check_name,
  exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_check'
      and conrelid = 'public.profiles'::regclass
  ) as passed;

insert into _contract (check_name, passed)
select
  'username availability does not expose email addresses' as check_name,
  count(*) > 0 and bool_and(
    p.prorettype = 'boolean'::regtype
    and pg_get_function_result(p.oid) = 'boolean'
  ) as passed
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

commit;
