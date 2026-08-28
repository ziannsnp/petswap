create type public.pet_species as enum (
  'dog',
  'cat',
  'rabbit',
  'hamster',
  'guinea_pig',
  'fish',
  'reptile',
  'exotic_mammal',
  'bird',
  'other'
);

alter table public.profiles
  add column username varchar(30),
  add constraint profiles_username_key unique (username);

update public.profiles
set username = 'u_' || substr(replace(id::text, '-', ''), 1, 28)
where username is null;

alter table public.profiles
  alter column username set not null,
  alter column phone_number type varchar(10);

alter table public.pets
  rename column age_years to age_year;

alter table public.pets
  rename column feeding_instructions to feeding_instruction;

alter table public.pets
  rename column medical_notes to medical_note;

alter table public.pets
  rename column behavior_notes to behavior_note;

alter table public.pets
  rename column special_requirements to special_requirement;

alter table public.pets
  drop constraint if exists pets_age_years_check;

alter table public.pets
  add constraint pets_age_year_check check (age_year >= 0);

alter table public.pets
  add column species_migrated public.pet_species;

update public.pets
set species_migrated = (
    case lower(trim(species::text))
      when 'dog' then 'dog'
      when 'cat' then 'cat'
      when 'rabbit' then 'rabbit'
      when 'hamster' then 'hamster'
      when 'guinea pig' then 'guinea_pig'
      when 'guinea_pig' then 'guinea_pig'
      when 'fish' then 'fish'
      when 'betta' then 'fish'
      when 'goldfish' then 'fish'
      when 'koi' then 'fish'
      when 'guppy' then 'fish'
      when 'molly' then 'fish'
      when 'platy' then 'fish'
      when 'tetra' then 'fish'
      when 'reptile' then 'reptile'
      when 'leopard gecko' then 'reptile'
      when 'crested gecko' then 'reptile'
      when 'bearded dragon' then 'reptile'
      when 'corn snake' then 'reptile'
      when 'king snake' then 'reptile'
      when 'milk snake' then 'reptile'
      when 'exotic mammal' then 'exotic_mammal'
      when 'exotic_mammal' then 'exotic_mammal'
      when 'chinchilla' then 'exotic_mammal'
      when 'gerbil' then 'exotic_mammal'
      when 'fancy rat' then 'exotic_mammal'
      when 'fancy mouse' then 'exotic_mammal'
      when 'degu' then 'exotic_mammal'
      when 'african pygmy hedgehog' then 'exotic_mammal'
      when 'sugar glider' then 'exotic_mammal'
      when 'bird' then 'bird'
      when 'budgerigar' then 'bird'
      when 'cockatiel' then 'bird'
      when 'lovebird' then 'bird'
      when 'canary' then 'bird'
      when 'finch' then 'bird'
      else 'other'
    end
  )::public.pet_species;

alter table public.pets
  drop column species;

alter table public.pets
  rename column species_migrated to species;

alter table public.pets
  alter column species set not null;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'PetSwap user'),
    'u_' || substr(replace(new.id::text, '-', ''), 1, 28)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;