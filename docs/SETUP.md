# Setup — Centurio on a fresh Supabase project

End-to-end steps to stand up Centurio against a **brand-new** Supabase project.

## 1. Prerequisites
- Node + Expo tooling (`npm install`).
- Supabase CLI (`npx supabase`) and a Supabase account.
- A Google Gemini API key (Google AI Studio). Keep it **server-side only**.

## 2. Create & link the Supabase project
```bash
npx supabase login
npx supabase link --project-ref <YOUR_NEW_PROJECT_REF>
```

## 3. Apply the schema + seed
The schema is a single consolidated migration; the seed inserts the global
categories.
```bash
npx supabase db push          # applies supabase/migrations/*
npx supabase db seed          # or run supabase/seed.sql in the SQL editor
```
This creates `users`, `categories`, `transactions`, `learning_rules`, all RLS
policies, the auth→users trigger, growth guards and indexes.

## 4. Deploy the edge functions
```bash
npx supabase functions deploy process-text process-audio process-image
```
Each function validates the caller's JWT (`requireUser`) and calls Gemini
server-side.

## 5. Set the function secret (Gemini key — server-side only)
```bash
npx supabase secrets set GEMINI_API_KEY=<YOUR_GEMINI_KEY>
# optional: pin a model
npx supabase secrets set GEMINI_MODEL=gemini-2.0-flash
```
`SUPABASE_URL` / `SUPABASE_ANON_KEY` are auto-provided to functions for JWT
validation — you don't set them.

## 6. App environment
Copy `.env.example` → `.env` and fill in the **new** project's values:
```
EXPO_PUBLIC_SUPABASE_URL=https://<YOUR_NEW_PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<new anon key>
```
Do **not** add `EXPO_PUBLIC_GEMINI_API_KEY` — the app never talks to Gemini directly.

For builds, set these as **EAS environment variables** (not in `eas.json`):
```bash
eas env:create --environment preview     --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
eas env:create --environment preview     --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
# repeat for the production environment
```

## 7. Run / build
```bash
npm start                                   # local dev (Expo)
eas build --platform android --profile preview
```

## Local development (optional)
```bash
npx supabase start                          # local stack
npx supabase functions serve                # serve functions; reads supabase/.env.local for GEMINI_API_KEY
```
Point `.env` at the local URL/anon key printed by `supabase start`.

## Notes
- Local CLI state (`supabase/.temp`, `.branches`) and `supabase/.env.local` are
  git-ignored and regenerate on link/serve — safe to delete.
- Typecheck the app with `npx tsc --noEmit` (Deno edge functions are excluded).
