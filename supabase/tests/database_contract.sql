-- Run after `npx supabase db reset`, then create/sign in local users through
-- Studio or app flows before testing RLS with authenticated JWTs.

select
  'confirmed bookings use end-exclusive overlap protection' as check_name,
  exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_confirmed_overlap'
      and conrelid = 'public.bookings'::regclass
  ) as passed;

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

select
  'booking participant policies are installed' as check_name,
  count(*) >= 4 as passed
from pg_policies
where schemaname = 'public'
  and tablename = 'bookings';

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
