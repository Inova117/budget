# Changelog

## V2 — consolidation & flagship features

V2 made the app use the schema it already had, removed shipped secrets, and built
the PRD features that were missing. Not a rewrite.

### Correctness & architecture
- **One persisted Supabase client** (`src/lib/supabase.ts`) with AsyncStorage +
  AppState auto-refresh — sessions survive cold start. Removed the duplicate/dummy
  clients.
- **Correct data model**: transactions use `category_id` (FK) and store the real
  transcript in `raw_transcript`; UI category names derive from the FK join.
  (V1 crammed the category name into `raw_transcript` and discarded the transcript.)
- **Timezone-correct dates** everywhere (`src/utils/dates.ts`) — fixes off-by-one
  "today / this month" totals.
- Optimistic add/delete + pull-to-refresh (no full refetch per action).

### Security
- Gemini key removed from the client; audio uploads to Google happen server-side.
- Edge functions validate the JWT (`requireUser`).
- Secrets removed from `eas.json`; `.apk/.aab/.ipa` git-ignored.

### Features (previously promised, now implemented)
- **AI text parsing** (`process-text`) — multi-expense extraction from typed text,
  with an offline local fallback.
- **Confidence + needs-review** dot for low-certainty parses; cleared once reviewed
  in the confirm modal.
- **Habit learning** — vendor→category corrections persist to `learning_rules` and
  auto-apply.
- **Multi-currency** via `users.preferences.currency` + a picker in Profile.
- **Receipts** route through the confirm modal and default to one aggregated total.

### Polish
- Accessibility labels/roles + haptics; stable Gemini model id; package renamed to
  `centurio` v2.

### Schema (fresh-project consolidation)
- The four V1 migrations are consolidated into a single `initial_schema.sql`.
- Removed the no-op `user_id = user_id` constraint.
- Added a **per-user unique category index** (`lower(trim(name))`) and indexes on
  `transactions.category_id` / `learning_rules.user_id`.
- Fixed `seed.sql` global-category icons (emoji → lucide names the app renders).
- The V2 data-backfill migration was dropped (a fresh project has no legacy rows).
