-- ============================================================================
-- Centurio — initial schema (consolidated for a fresh Supabase project).
--
-- Tables, RLS, the auth→users trigger, integrity constraints, growth guards,
-- indexes and grants. This single file replaces the V1 incremental migrations.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────────────────────────

-- Extends Supabase auth.users with app preferences (currency, timezone…).
create table public.users (
  id uuid references auth.users not null primary key,
  preferences jsonb default '{"currency": "USD", "timezone": "UTC"}'::jsonb,
  created_at timestamptz default timezone('utc', now()) not null
);
comment on table public.users is 'User preferences corresponding to Supabase auth.users.';

-- user_id null => global/default category visible to everyone.
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz default timezone('utc', now()) not null,
  constraint categories_name_nonempty check (trim(name) <> '')
);
comment on table public.categories is 'Transaction categories. Null user_id means a global category.';

-- The main expense ledger. category_id is the FK; raw_transcript holds the
-- actual spoken/typed text (NOT the category name).
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  vendor_name text not null,
  category_id uuid references public.categories(id) on delete set null,
  raw_transcript text,
  timestamp timestamptz default timezone('utc', now()) not null,
  needs_review boolean default false,
  created_at timestamptz default timezone('utc', now()) not null,
  constraint transactions_amount_positive check (amount > 0)
);
comment on table public.transactions is 'Expense ledger. Populated via the LLM parser; category via category_id FK.';

-- Habit engine: learned vendor → category overrides.
create table public.learning_rules (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  vendor_pattern text not null,
  enforced_category_id uuid references public.categories(id) on delete cascade not null,
  confidence numeric(4, 3) default 1.0,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (user_id, vendor_pattern)
);
comment on table public.learning_rules is 'User-specific vendor→category learning for auto-categorization.';

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index idx_transactions_user_timestamp on public.transactions (user_id, timestamp desc);
create index idx_transactions_category on public.transactions (category_id);
create index idx_categories_user on public.categories (user_id);
create index idx_learning_rules_user on public.learning_rules (user_id);
-- Prevent duplicate per-user categories regardless of case/whitespace.
create unique index categories_user_name_unique on public.categories (user_id, lower(trim(name)));

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.learning_rules enable row level security;

-- users: read/update own row (insert is handled by the trigger below).
create policy "Users can view own preferences" on public.users
  for select using (auth.uid() = id);
create policy "Users can update own preferences" on public.users
  for update using (auth.uid() = id);

-- categories: see global or own; modify own or global.
create policy "Users can view global or own categories" on public.categories
  for select using (user_id is null or auth.uid() = user_id);
create policy "Users can insert own categories" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "Users can update own or global categories" on public.categories
  for update using (user_id is null or auth.uid() = user_id);
create policy "Users can delete own or global categories" on public.categories
  for delete using (user_id is null or auth.uid() = user_id);

-- transactions: only your own.
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.transactions
  for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

-- learning_rules: only your own.
create policy "Users can view own learning rules" on public.learning_rules
  for select using (auth.uid() = user_id);
create policy "Users can insert own learning rules" on public.learning_rules
  for insert with check (auth.uid() = user_id);
create policy "Users can update own learning rules" on public.learning_rules
  for update using (auth.uid() = user_id);
create policy "Users can delete own learning rules" on public.learning_rules
  for delete using (auth.uid() = user_id);

-- ── Auto-provision public.users on signup ───────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Growth guards (belt + suspenders against runaway data) ──────────────────
create or replace function public.check_transaction_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare cnt integer;
begin
  select count(*) into cnt from public.transactions where user_id = new.user_id;
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

create or replace function public.check_category_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare cnt integer;
begin
  if new.user_id is not null then
    select count(*) into cnt from public.categories where user_id = new.user_id;
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

-- ── Grants (RLS still governs row access) ───────────────────────────────────
revoke all on public.learning_rules from anon;
revoke all on public.users from anon;

grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.learning_rules to authenticated;
