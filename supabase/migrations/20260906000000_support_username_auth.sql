alter table public.profiles
  add constraint profiles_username_format_check check (
    username = lower(username)
    and username ~ '^[a-z0-9_]{3,30}$'
  );

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate_username = lower(candidate_username)
    and candidate_username ~ '^[a-z0-9_]{3,30}$'
    and not exists (
      select 1
      from public.profiles
      where username = candidate_username
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submitted_consent_version text := nullif(new.raw_user_meta_data ->> 'consent_version', '');
  submitted_username text := nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '');
begin
  insert into public.profiles (id, display_name, username, consent_version, consent_given_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'PetSwap user'),
    coalesce(submitted_username, 'u_' || substr(replace(new.id::text, '-', ''), 1, 28)),
    submitted_consent_version,
    case when submitted_consent_version is not null then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
