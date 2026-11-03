\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  host_record record;
begin
  select * into host_record
  from public.get_listing_host('30000000-0000-4000-8000-000000000001');

  if not found
    or host_record.id <> '10000000-0000-4000-8000-000000000001'
    or host_record.display_name <> 'Alex Rivera'
    or host_record.location <> 'Chiang Mai' then
    raise exception 'listing host access: anonymous visitor cannot read the public host projection';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'listing host access: anonymous visitor can read a profile row directly';
  end if;

  if exists (
    select 1
    from public.get_listing_host('30000000-0000-4000-8000-000000000004')
  ) then
    raise exception 'listing host access: anonymous visitor can read a draft listing host';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if not exists (
    select 1
    from public.get_listing_host('30000000-0000-4000-8000-000000000004')
    where id = '10000000-0000-4000-8000-000000000001'
      and display_name = 'Alex Rivera'
  ) then
    raise exception 'listing host access: owner cannot read the host projection for their draft';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if exists (
    select 1
    from public.get_listing_host('30000000-0000-4000-8000-000000000004')
  ) then
    raise exception 'listing host access: another authenticated user can read a draft listing host';
  end if;
end;
$$;

rollback;
