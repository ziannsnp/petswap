create or replace function public.set_listing_publication_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'published' then
    new.published_at = null;
  elsif tg_op = 'INSERT' or old.status is distinct from 'published' then
    new.published_at = now();
  else
    new.published_at = old.published_at;
  end if;

  return new;
end;
$$;

create trigger set_listing_publication_timestamp
before insert or update of status, published_at on public.listings
for each row execute function public.set_listing_publication_timestamp();