\set ON_ERROR_STOP on

begin;

-- The seeded draft and published listings are both owned by Alex. Object names
-- follow the listing-id folder contract used by the storage RLS helpers.
insert into storage.objects (id, bucket_id, name)
values
  (
    '50000000-0000-4000-8000-000000000001',
    'listing-photos',
    '30000000-0000-4000-8000-000000000004/contract-draft.jpg'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'listing-photos',
    '30000000-0000-4000-8000-000000000001/contract-published.jpg'
  );

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
    from storage.objects
    where bucket_id = 'listing-photos'
      and name = '30000000-0000-4000-8000-000000000004/contract-draft.jpg'
  ) then
    raise exception 'listing photo access: the owner cannot read their draft photo';
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
    from storage.objects
    where bucket_id = 'listing-photos'
      and name = '30000000-0000-4000-8000-000000000004/contract-draft.jpg'
  ) then
    raise exception 'listing photo access: another authenticated user can read a draft photo';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'listing-photos'
      and name = '30000000-0000-4000-8000-000000000004/contract-draft.jpg'
  ) then
    raise exception 'listing photo access: an anonymous user can read a draft photo';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'listing-photos'
      and name = '30000000-0000-4000-8000-000000000001/contract-published.jpg'
  ) then
    raise exception 'listing photo access: an anonymous user cannot select a published photo for signing';
  end if;
end;
$$;

reset role;
rollback;
