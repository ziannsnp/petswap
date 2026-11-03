-- Profile RLS enforcement tests for FR-1.2:
-- "users cannot edit another profile"
--
-- Proves that:
-- 1. An authenticated user can update their own profile fields.
-- 2. An authenticated user cannot update another user's profile (0 rows affected).
-- 3. An authenticated user cannot delete another user's profile (0 rows affected).
-- 4. An anonymous visitor cannot update any profile (0 rows affected).

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- 1. Alex updates Alex's own profile (valid owner update)
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed_rows integer;
begin
  update public.profiles
  set
    display_name = 'Alex Rivera Updated',
    phone_number = '0899999999',
    location = 'Phuket'
  where id = '10000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'profile update: owner update changed % rows instead of 1', changed_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Blair attempts to update Alex's profile (adversarial update across users)
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed_rows integer;
begin
  update public.profiles
  set display_name = 'Malicious Hijack'
  where id = '10000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'profile update: non-owner updated another user profile (changed % rows)', changed_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Blair attempts to delete Alex's profile (adversarial delete across users)
-- ---------------------------------------------------------------------------
do $$
declare
  changed_rows integer;
begin
  delete from public.profiles
  where id = '10000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'profile delete: non-owner deleted another user profile (changed % rows)', changed_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Anonymous user attempts to update Alex's profile
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

do $$
declare
  changed_rows integer;
begin
  update public.profiles
  set display_name = 'Anonymous Malicious'
  where id = '10000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'profile update: anonymous user updated a profile (changed % rows)', changed_rows;
  end if;
end;
$$;

rollback;
