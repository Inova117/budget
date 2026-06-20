-- Default global categories (user_id null → visible to everyone).
-- icon values MUST match lucide-react-native names in the app's ICON_MAP
-- (CategoriesScreen / DashboardScreen), otherwise they render as a fallback box.
insert into public.categories (name, icon)
values
  ('Groceries',      'ShoppingCart'),
  ('Dining',         'Utensils'),
  ('Transportation', 'Car'),
  ('Housing',        'Home'),
  ('Utilities',      'Lightbulb'),
  ('Entertainment',  'Film'),
  ('Healthcare',     'Heart'),
  ('Personal Care',  'Droplet'),
  ('Shopping',       'ShoppingBag'),
  ('Subscriptions',  'Music'),
  ('Travel',         'Plane'),
  ('Miscellaneous',  'Package')
on conflict do nothing;
