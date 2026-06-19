// ─────────────────────────────────────────────────────────────────────────────
// Centralized, timezone-consistent date helpers.
//
// The V1 bug: some code keyed days off `new Date().toISOString().slice(0,10)`
// (UTC) while other code built boundaries from local `new Date(y, m, d)`. For
// every user in a negative UTC offset (i.e. all of the Americas), "spent today"
// and month/week boundaries flipped a day around local midnight.
//
// Fix: derive every day/period boundary from the device's LOCAL calendar, in a
// single place, so all screens agree.
// ─────────────────────────────────────────────────────────────────────────────

export type Period = 'today' | 'week' | 'month' | 'all';

/** Local `YYYY-MM-DD` key for a Date or ISO timestamp (NOT UTC). */
export function localDayKey(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local `YYYY-MM` key for a Date or ISO timestamp. */
export function localMonthKey(input: Date | string): string {
  return localDayKey(input).slice(0, 7);
}

/** Today's local day key. */
export function todayKey(): string {
  return localDayKey(new Date());
}

/** Local midnight Date for the start of the ISO week (Monday) containing `d`. */
export function startOfWeek(d: Date = new Date()): Date {
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
}

/** Local midnight for the start of `d`'s month. */
export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** Local midnight for the start of `d`'s day. */
export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Start boundary (local) for a dashboard period filter. */
export function periodStart(period: Period, now: Date = new Date()): Date {
  switch (period) {
    case 'today':
      return startOfDay(now);
    case 'week':
      return startOfWeek(now);
    case 'month':
      return startOfMonth(now);
    case 'all':
    default:
      return new Date(0);
  }
}
