-- Insert default global categories
-- These have a NULL user_id so they are visible to everyone
insert into public.categories (name, icon)
values
  ('Groceries', '🛒'),
  ('Dining', '🍔'),
  ('Transportation', '🚗'),
  ('Housing', '🏠'),
  ('Utilities', '💡'),
  ('Entertainment', '🎬'),
  ('Healthcare', '⚕️'),
  ('Personal Care', '🧴'),
  ('Shopping', '🛍️'),
  ('Subscriptions', '🔁'),
  ('Travel', '✈️'),
  ('Miscellaneous', '📦')
on conflict do nothing;
