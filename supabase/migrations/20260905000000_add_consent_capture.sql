alter table public.profiles
  add column consent_version text,
  add column consent_given_at timestamptz,
  add constraint profiles_consent_pair_check check (
    (consent_version is null and consent_given_at is null)
    or (consent_version is not null and consent_given_at is not null)
  );

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submitted_consent_version text := nullif(new.raw_user_meta_data ->> 'consent_version', '');
begin
  insert into public.profiles (id, display_name, username, consent_version, consent_given_at)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'PetSwap user'),
    'u_' || substr(replace(new.id::text, '-', ''), 1, 28),
    submitted_consent_version,
    case when submitted_consent_version is not null then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
