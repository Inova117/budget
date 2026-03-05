-- Auto-create a row in public.users whenever a new auth.users is created.
-- This is required because the transactions table FK references public.users(id),
-- not auth.users(id) directly.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop if exists, then recreate cleanly
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
