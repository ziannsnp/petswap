-- BH-04: listings.capacity only had `capacity > 0`, so a client that skipped the form could store
-- a value up to the integer limit (the form now stops at 50, see LISTING_CAPACITY_MAX).
--
-- NOT VALID enforces the cap on every insert and on every update of a row, but does not scan
-- existing rows, so applying this to a hosted database that already holds a larger value cannot
-- fail the migration. The seed and the compose stack hold at most 3. Run
-- `alter table public.listings validate constraint listings_capacity_max_check;` once no row
-- exceeds 50.
alter table public.listings
  add constraint listings_capacity_max_check check (capacity <= 50) not valid;
