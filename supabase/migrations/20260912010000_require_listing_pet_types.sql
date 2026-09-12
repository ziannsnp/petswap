do $$
begin
  if exists (
    select 1
    from public.listings
    where cardinality(accepted_pet_types) = 0
  ) then
    raise exception 'Cannot require accepted pet types while listings with no accepted pet type exist. Update those listings before applying this migration.';
  end if;
end;
$$;

alter table public.listings
  alter column accepted_pet_types drop default;

alter table public.listings
  add constraint listings_accepted_pet_types_not_empty_check
  check (cardinality(accepted_pet_types) > 0);
