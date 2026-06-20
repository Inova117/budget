# Security model

How Centurio protects the Gemini key and user data. (Supersedes the V1
"SECURITY_IMPLEMENTATION" notes, where the key still partly shipped in the app.)

## Architecture
```
[Mobile App]
   │  authenticated request (user JWT, attached automatically by supabase-js)
   ▼
[Supabase Edge Function]  ── validates JWT (requireUser) ──► 401 if invalid
   │  with GEMINI_API_KEY (server secret)
   ▼
[Google Gemini API]
```

## Key protection
- The Gemini key lives **only** as a Supabase Edge Function secret
  (`supabase secrets set GEMINI_API_KEY=…`). It is never bundled in the app.
- The app has **no** `EXPO_PUBLIC_GEMINI_API_KEY`. Audio, text and images are all
  sent to the edge functions, which call Gemini (and, for audio, do the Google
  Files upload) server-side.
- Build-time env (`EXPO_PUBLIC_SUPABASE_*`) lives in EAS environment variables,
  not in git-tracked `eas.json`.

## Auth & access
- Every AI function calls `requireUser` (validates the Supabase JWT via
  `auth.getUser`) before touching Gemini — a missing/forged token gets 401, so
  the quota can't be drained by anonymous callers.
- All tables enforce Row Level Security scoped to `auth.uid()`; `public.users`
  and `public.learning_rules` additionally revoke the `anon` role.
- Integrity constraints (`amount > 0`, non-empty category names, per-user unique
  category names) and growth guards (≤10k tx, ≤50 custom categories/user).

## Data handling
- Voice recordings and receipt images are processed transiently and not
  permanently stored by Centurio (see `docs/privacy-policy.en.md`).
- `transactions.raw_transcript` stores the user's own spoken/typed text (used by
  the habit engine), not third-party data.

## If a key leaks
1. Rotate the Gemini key in Google AI Studio.
2. Rotate the Supabase anon key if it was exposed.
3. Re-set the function secret and rebuild; purge the secret from git history if
   it was ever committed.

## Hardening backlog
- Per-user rate limiting in the edge functions (key on the verified `user.id`).
- Response caching for repeated parses.
