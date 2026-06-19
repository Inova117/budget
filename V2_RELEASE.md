# Centurio V2 — Change Log & Deploy Checklist

V2 is a **consolidation, not a rewrite**: the UI, DB schema, and AI scaffolding
were sound; the app simply ignored its own schema, shipped secrets, and never
built its flagship features. V2 fixes that.

## What changed (code)

### Correctness / architecture (P0)
- **One Supabase client.** Deleted the broken root `supabase.ts` (dummy-JWT
  scratch file) and the unused `src/utils/supabase.ts`. `src/lib/supabase.ts` now
  persists the session to AsyncStorage and auto-refreshes via AppState → users
  stay logged in across cold starts; voice/receipt no longer hit "Not authenticated".
- **Correct data model.** Transactions now write `category_id` (FK) and store the
  real transcript in `raw_transcript` (V1 crammed the category name there and threw
  the transcript away). UI category names derive from the FK join, backward-compatible
  with legacy rows.
- **Timezone-correct dates.** New `src/utils/dates.ts`; every "today / this month /
  this week" boundary is computed on the local calendar (was a mix of local + UTC).
- Optimistic add/delete (no more full 200-row refetch on every action); pull-to-refresh.

### Security (P0)
- **Gemini key removed from the client.** Audio is now uploaded to Google
  **server-side** by `process-audio`; the app never reads `EXPO_PUBLIC_GEMINI_API_KEY`.
- **Edge functions validate the JWT** (`requireUser`) — V1 only checked a header
  existed, so anyone could spend your Gemini quota.
- **Secrets stripped from `eas.json`** (was git-tracked with the live Gemini key);
  `.apk/.aab/.ipa` now git-ignored.

### Missing PRD features, now implemented (P1)
- **AI text parsing** via new `process-text` edge function — the headline
  "$30 super, 15 taxi → 2 items" now works for typed input (was a dumb regex).
  Falls back to local parsing offline so an entry is never lost.
- **Confidence + needs-review.** All three functions return per-expense confidence;
  `< 0.85` flags `needs_review`, shown as a subtle dot in the list and confirm modal.
- **Habit learning.** Vendor→category corrections upsert a `learning_rules` row and
  auto-apply to future parses (`applyLearningRules`) — the PRD's "Smart Correction".
- **Multi-currency.** `formatMoney` reads `users.preferences.currency`; currency
  picker added to Profile (was hardcoded `$`).
- **Receipts** go through the confirm modal like voice (no more silent auto-save) and
  default to ONE aggregated transaction (total), not N line items.

### Polish (P2)
- Accessibility labels/roles/state on the mic, camera, keyboard, and tx rows; light
  haptics. Stable Gemini model id (`gemini-2.0-flash`). `package.json` → `centurio` v2.
  Edge functions excluded from the app typecheck.

## ⚠️ Required out-of-band actions (a human must do these)

These cannot be done from the codebase and **block a safe production release**:

1. **Rotate the leaked Gemini API key** (the `AIza…` previously in `eas.json`) in
   Google AI Studio — it is in git history and must be considered compromised.
2. **Rotate the Supabase keys** for project `dwsdipyzbdtvijiwbmch` (the anon key is
   public by design, but it leaked next to the secret one — rotate to be safe).
3. **Purge git history** of the old `eas.json` secrets (BFG / `git filter-repo`), or
   at minimum confirm the rotated keys are dead. Coordinate the force-push.
4. **Set the function secret:** `supabase secrets set GEMINI_API_KEY=<new key>`
   (and optionally `GEMINI_MODEL`). `SUPABASE_URL` / `SUPABASE_ANON_KEY` are
   auto-provided to functions for JWT validation.
5. **Set build env as EAS environment variables** (`eas env:create`) for
   `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` per profile — they
   are no longer in `eas.json`.
6. **Deploy the functions:** `supabase functions deploy process-text process-audio process-image`.
7. **Run the data migration** `supabase/migrations/20260618000000_v2_backfill_category_id.sql`
   against production, then verify `select count(*) from transactions where category_id is null`
   is ~0 before relying on category grouping.
8. **Rebuild & replace the old APKs** (`Centurio-preview*.apk`) — they embed the old
   Gemini key. Don't distribute them.
