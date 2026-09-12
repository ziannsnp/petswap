-- Profile avatars are publicly readable, while an authenticated user can only
-- create, replace, or remove objects directly in their own UUID-named folder.

\set ON_ERROR_STOP on

begin;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000010',
  'avatars',
  '10000000-0000-4000-8000-000000000001/avatar.jpg'
);

update storage.objects
set metadata = '{"version": "replacement"}'::jsonb
where bucket_id = 'avatars'
  and name = '10000000-0000-4000-8000-000000000001/avatar.jpg';

do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000011',
      'avatars',
      '10000000-0000-4000-8000-000000000002/avatar.jpg'
    );
    raise exception 'avatar access: a user uploaded into another user''s folder';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'avatars'
      and name = '10000000-0000-4000-8000-000000000001/avatar.jpg'
  ) then
    raise exception 'avatar access: an anonymous user cannot read a public avatar';
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

delete from storage.objects
where bucket_id = 'avatars'
  and name = '10000000-0000-4000-8000-000000000001/avatar.jpg';

reset role;
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'avatars'
      and name = '10000000-0000-4000-8000-000000000001/avatar.jpg'
  ) then
    raise exception 'avatar access: a user deleted another user''s avatar';
  end if;
end;
$$;

rollback;
