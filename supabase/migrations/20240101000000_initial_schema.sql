-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table (Extends Supabase auth.users)
create table public.users (
  id uuid references auth.users not null primary key,
  preferences jsonb default '{"currency": "USD", "timezone": "UTC"}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.users is 'User preferences corresponding to Supabase auth.users.';

-- 2. Categories Table
-- user_id is null for global/default categories
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.categories is 'Categories for transactions. Null user_id means global category.';

-- 3. Transactions Table
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  vendor_name text not null,
  category_id uuid references public.categories(id) on delete set null,
  raw_transcript text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  needs_review boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.transactions is 'Main expense ledger. Populated via LLM parser.';

-- 4. Learning Rules Table (Habit Engine)
create table public.learning_rules (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  vendor_pattern text not null,
  enforced_category_id uuid references public.categories(id) on delete cascade not null,
  confidence numeric(4, 3) default 1.0, -- e.g., 0.95 for 95% confident
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- ensure a user doesn't have duplicate identical rules
  unique(user_id, vendor_pattern) 
);

comment on table public.learning_rules is 'User-specific habit learning for automatic vendor categorization.';

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.learning_rules enable row level security;

-- Users can read and update their own preferences
create policy "Users can view own preferences" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own preferences" on public.users
  for update using (auth.uid() = id);

-- Categories: Users can see global categories (user_id IS NULL) OR their own categories
create policy "Users can view global or own categories" on public.categories
  for select using (user_id is null or auth.uid() = user_id);

create policy "Users can insert own categories" on public.categories
  for insert with check (auth.uid() = user_id);

create policy "Users can update own categories" on public.categories
  for update using (auth.uid() = user_id);

create policy "Users can delete own categories" on public.categories
  for delete using (auth.uid() = user_id);

-- Transactions: Users can only see/modify their own transactions
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions" on public.transactions
  for update using (auth.uid() = user_id);

create policy "Users can delete own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

-- Learning Rules: Users can only see/modify their own learning rules
create policy "Users can view own learning rules" on public.learning_rules
  for select using (auth.uid() = user_id);

create policy "Users can insert own learning rules" on public.learning_rules
  for insert with check (auth.uid() = user_id);

create policy "Users can update own learning rules" on public.learning_rules
  for update using (auth.uid() = user_id);

create policy "Users can delete own learning rules" on public.learning_rules
  for delete using (auth.uid() = user_id);
