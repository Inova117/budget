-- Allow users to delete global categories (user_id IS NULL) in addition to their own
-- This replaces the previous policy that only allowed deleting own categories

drop policy if exists "Users can delete own categories" on public.categories;

create policy "Users can delete own or global categories" on public.categories
  for delete using (user_id is null or auth.uid() = user_id);

-- Also allow users to update global categories
drop policy if exists "Users can update own categories" on public.categories;

create policy "Users can update own or global categories" on public.categories
  for update using (user_id is null or auth.uid() = user_id);
