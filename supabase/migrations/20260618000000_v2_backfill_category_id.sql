-- ============================================================================
-- V2 data migration: stop encoding the category NAME in raw_transcript.
--
-- V1 wrote the category name into transactions.raw_transcript and left
-- category_id NULL. V2 uses category_id (FK) for the category and reserves
-- raw_transcript for the actual spoken/typed text. This backfills the FK from
-- the legacy names, then clears the misused column.
--
-- Idempotent (guarded by category_id IS NULL) and wrapped in a transaction.
-- The true transcript of legacy rows was never stored and cannot be recovered;
-- that is acceptable — V2 starts capturing it going forward.
-- ============================================================================

begin;

-- 1. Match against the user's OWN categories first (case-insensitive).
update public.transactions t
set category_id = c.id
from public.categories c
where t.category_id is null
  and t.raw_transcript is not null
  and lower(trim(t.raw_transcript)) = lower(trim(c.name))
  and c.user_id = t.user_id;

-- 2. Then fall back to GLOBAL categories for anything still unmatched.
update public.transactions t
set category_id = c.id
from public.categories c
where t.category_id is null
  and t.raw_transcript is not null
  and lower(trim(t.raw_transcript)) = lower(trim(c.name))
  and c.user_id is null;

-- 3. Anything still unmatched maps to the global "Miscellaneous" bucket
--    (avoids breaching the 50-custom-category cap on noisy legacy data).
update public.transactions t
set category_id = c.id
from public.categories c
where t.category_id is null
  and t.raw_transcript is not null
  and c.user_id is null
  and c.name = 'Miscellaneous';

-- 4. Now that the category lives in category_id, clear the misused column so
--    raw_transcript cleanly means "spoken/typed text" from V2 onward. Only for
--    rows we successfully linked, so we never lose the sole category signal.
update public.transactions
set raw_transcript = null
where category_id is not null
  and raw_transcript is not null;

-- 5. Legacy rows were user-confirmed, so they don't need review.
update public.transactions
set needs_review = false
where needs_review is null;

commit;

-- Helpful indexes for the V2 access patterns (category grouping, rule lookups).
create index if not exists idx_transactions_category on public.transactions (category_id);
create index if not exists idx_learning_rules_user on public.learning_rules (user_id);
