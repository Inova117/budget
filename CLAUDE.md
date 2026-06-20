# Centurio — Codebase Guide

Invisible-input budget tracker. Speak, type, or scan an expense → AI parses it →
minimalist "Breathe" dashboard. React Native (Expo SDK 54, RN 0.81, React 19) +
Supabase (Postgres, Auth, Edge Functions) + Google Gemini.

## Architecture

```
App.tsx ──auth gate──> AuthScreen | AppProvider → TabNavigator
                                        │
                          src/context/AppContext.tsx  ← single state hub
                                        │
        ┌───────────────┬──────────────┼───────────────┬─────────────┐
     Home (log)    Dashboard       Categories        Profile     components/
   voice/text/scan  insights         CRUD          budget+currency  utils/
                                        │
                              src/lib/supabase.ts  ← THE ONLY client
                                        │
                         Supabase  (RLS-scoped Postgres + Edge Functions)
                                        │
                  process-text / process-audio / process-image  → Gemini
```

### Hard rules
- **One Supabase client only:** `src/lib/supabase.ts`. It configures AsyncStorage
  session persistence + AppState auto-refresh. Never call `createClient` elsewhere
  (two GoTrue instances = divergent sessions = sporadic "Not authenticated").
- **The DB schema is the contract.** A transaction's category is `category_id`
  (FK → `categories`), and `raw_transcript` holds the *actual spoken/typed text*.
  Do **not** stuff the category name into `raw_transcript` (the V1 bug). Category
  names shown in the UI are derived from the FK join in `rowToTransaction`.
- **No secrets in the client.** The Gemini key lives only as a Supabase Edge
  Function secret. The app calls JWT-validated edge functions; it never talks to
  Google directly and never reads `EXPO_PUBLIC_GEMINI_API_KEY`.
- **Dates are local.** Use `src/utils/dates.ts` (`localDayKey`, `periodStart`…) —
  never `toISOString().slice(0,10)` (that's UTC and breaks for the Americas).
- **Money is formatted from preferences.** Use `formatMoney` from `useApp()` (bound
  to `users.preferences.currency`) — never hardcode `$`.

### Key modules
- `src/context/AppContext.tsx` — transactions, categories, learning rules, budget,
  currency, health score. Optimistic add/delete. `applyLearningRules()` overrides
  AI categories from learned vendor→category corrections before the confirm modal.
- `src/utils/dates.ts` — timezone-consistent day/week/month boundaries.
- `src/utils/format.ts` — `formatMoney(amount, currency)` (Intl with a manual fallback).
- `supabase/functions/_shared/parse.ts` — JWT validation (`requireUser`), Gemini call,
  tolerant JSON parsing, expense normalization. Shared by all three functions.

### Data model (Postgres)
`users(preferences)` · `categories(user_id null=global)` ·
`transactions(amount, vendor_name, category_id, raw_transcript, needs_review, timestamp)` ·
`learning_rules(vendor_pattern → enforced_category_id)`. All RLS-scoped to `auth.uid()`.

## Dev
- `npm start` (Expo). Env: copy `.env.example` → `.env`.
- Typecheck: `npx tsc --noEmit` (Deno edge functions are excluded via tsconfig).
- Edge functions deploy: `supabase functions deploy process-text process-audio process-image`.
- Function secrets: `supabase secrets set GEMINI_API_KEY=...` (and the default
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` are auto-provided for JWT validation).

See `docs/` for product, setup, security, changelog and store docs
(`docs/SETUP.md` covers standing up a fresh Supabase project).
