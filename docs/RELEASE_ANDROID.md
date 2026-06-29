# Android release checklist

Everything needed to ship Centurio's first Android build to Google Play.
Items marked **[you]** need your accounts/keys; the rest is already in the repo.

## 1. Backend (new Supabase project)
- [ ] **[you]** Run the schema + trigger SQL in the SQL Editor (per-user categories,
      currency-from-signup, RLS). The current trigger:
  ```sql
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    insert into public.users (id, preferences)
    values (new.id, jsonb_build_object('currency', coalesce(new.raw_user_meta_data->>'currency','USD'), 'timezone','UTC'))
    on conflict (id) do nothing;
    insert into public.categories (user_id, name, icon) values
      (new.id,'Groceries','ShoppingCart'),(new.id,'Dining','Utensils'),(new.id,'Transportation','Car'),
      (new.id,'Housing','Home'),(new.id,'Utilities','Lightbulb'),(new.id,'Entertainment','Film'),
      (new.id,'Healthcare','Heart'),(new.id,'Personal Care','Droplet'),(new.id,'Shopping','ShoppingBag'),
      (new.id,'Subscriptions','Music'),(new.id,'Travel','Plane'),(new.id,'Miscellaneous','Package')
    on conflict do nothing;
    return new;
  end; $$;
  ```
- [ ] **[you]** Deploy edge functions:
      `supabase functions deploy process-text process-audio process-image delete-account`
- [ ] **[you]** Set the Gemini secret with a REAL key (must start with `AIzaSy…`, from
      AI Studio — **not** the `AQ.…` token): `supabase secrets set GEMINI_API_KEY=AIzaSy...`
      (`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are auto-provided.)
- [ ] **[you]** Auth → Providers → Email: keep **Confirm email ON** for production.

## 2. Secrets / security
- [ ] **[you]** Rotate the OLD leaked Gemini key (it's in git history) in AI Studio.
- [ ] **[you]** Confirm no `EXPO_PUBLIC_GEMINI_*` anywhere (already removed from the app/.env).

## 3. Build env (EAS) — already done
The PUBLIC Supabase URL + anon key are in `eas.json` (preview + production `env`).
They're not secret (the anon key is RLS-protected and ships in every app), so no
`eas env:create` needed. The Gemini key is server-side only (step 1). ✅

## 4. Build & test on a REAL Android device
> Everything so far was reviewed on web, where voice + camera don't run. Test on device.
- [ ] **[you]** `eas build --platform android --profile preview` → install the APK on a phone.
- [ ] **[you]** Verify end to end: register → pick currency → categories → set monthly +
      per-category budgets → log an expense by **voice**, **text**, and **receipt scan** →
      Dashboard updates → edit/delete a transaction → **Delete Account**.
- [ ] **[you]** When happy: `eas build --platform android --profile production` → `.aab`.

## 5. Google Play listing
- [ ] **[you]** Play Console account ($25 one-time); create the app (category: Finance).
- [ ] **[you]** Host `docs/privacy-policy.en.md` at a public URL; add it in Play Console.
- [ ] **[you]** Data Safety form — declare collected data (see `docs/PLAY_STORE.md`).
- [ ] **[you]** Feature graphic (1024×500) + 2–8 screenshots (from the device build).
- [ ] **[you]** Content rating questionnaire; real support email (replace the placeholder).
- [ ] **[you]** Upload the `.aab`, set countries + pricing (Free), submit for review.

## Already done (in the repo)
- `app.json`: package `com.zerion.centurio`, version 1.0.0, versionCode 1, permissions +
  usage strings, adaptive icon. EAS production profile builds an `.aab`.
- **In-app account deletion** (Profile → Delete Account → `delete-account` edge function) —
  satisfies Google's account-deletion requirement.
- Listing copy: `docs/PLAY_STORE.md`. Privacy policies: `docs/privacy-policy.{en,es}.md`.

## Notes
- `expo-av` logs a deprecation warning on SDK 54 but still works; migrating to
  `expo-audio` is a future cleanup, not a launch blocker.
- The local `android/` folder is git-ignored — EAS does a clean managed prebuild in the
  cloud and picks up all config plugins (incl. expo-image-manipulator) automatically.
