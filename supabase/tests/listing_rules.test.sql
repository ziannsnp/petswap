\set ON_ERROR_STOP on

begin;

do $$
declare
  violated_constraint text;
begin
  begin
    insert into public.listings (
      id,
      owner_id,
      title,
      location,
      description,
      capacity,
      accepted_pet_types,
      status
    ) values (
      '30000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      'Invalid empty pet types',
      'Chiang Mai',
      'This row must never be accepted.',
      1,
      '{}'::public.pet_species[],
      'draft'
    );
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = CONSTRAINT_NAME;
  end;

  if violated_constraint is distinct from 'listings_accepted_pet_types_not_empty_check' then
    raise exception 'expected empty accepted pet types to fail listings_accepted_pet_types_not_empty_check, got %', violated_constraint;
  end if;
end;
$$;

rollback;
