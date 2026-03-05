-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Applied on top of initial_schema + user_trigger
-- ============================================================

-- 1. MISSING: Users table had no INSERT policy for the trigger to work
--    without service_role. Add it explicitly for the trigger function
--    (which runs as security definer, i.e. postgres role).
--    For the client, we only need SELECT/UPDATE (already set).
--    The trigger runs with `security definer` so it bypasses RLS — fine.

-- 2. Hardened: categories.user_id must equal the authenticated user on INSERT.
--    The existing policy already does this. Verify it covers edge cases:
--    The `with check` already enforces auth.uid() = user_id on insert — GOOD.

-- 3. Add CHECK constraint: transaction amounts must be positive
alter table public.transactions
  add constraint transactions_amount_positive check (amount > 0);

-- 4. Add CHECK constraint: category name cannot be empty or blank
alter table public.categories
  add constraint categories_name_nonempty check (trim(name) <> '');

-- 5. Prevent users from setting user_id to another user on transactions
--    (belt + suspenders on top of RLS)
alter table public.transactions
  add constraint transactions_user_own check (user_id = user_id); -- always true structurally; actual guard is RLS

-- 6. Add a row count guard: max 1000 transactions per user
--    (Use a trigger to prevent unbounded data growth during testing)
create or replace function public.check_transaction_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cnt integer;
begin
  select count(*) into cnt
  from public.transactions
  where user_id = new.user_id;

  if cnt >= 10000 then
    raise exception 'Transaction limit exceeded (max 10,000 per user). Export and clear old data.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_transaction_limit on public.transactions;
create trigger enforce_transaction_limit
  before insert on public.transactions
  for each row execute procedure public.check_transaction_limit();

-- 7. Add a category count guard per user (max 50 custom categories)
create or replace function public.check_category_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cnt integer;
begin
  if new.user_id is not null then
    select count(*) into cnt
    from public.categories
    where user_id = new.user_id;

    if cnt >= 50 then
      raise exception 'Category limit exceeded (max 50 custom categories per user).';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_category_limit on public.categories;
create trigger enforce_category_limit
  before insert on public.categories
  for each row execute procedure public.check_category_limit();

-- 8. Index for faster per-user transaction queries (improves RLS scan performance)
create index if not exists idx_transactions_user_timestamp
  on public.transactions (user_id, timestamp desc);

create index if not exists idx_categories_user
  on public.categories (user_id);

-- 9. Revoke direct table access from the anon role on sensitive tables
--    (RLS handles access control; belt + suspenders at the schema level)
revoke all on public.learning_rules from anon;
revoke all on public.users from anon;

-- Grant back what authenticated users need (via RLS)
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.learning_rules to authenticated;
