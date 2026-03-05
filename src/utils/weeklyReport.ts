import { Transaction } from '../context/AppContext';

export type WeekData = {
    label: string;        // e.g. "Feb 24"
    start: Date;
    end: Date;
    total: number;
};

export type WeeklyReport = {
    weeks: WeekData[];    // Last 4 weeks, oldest first
    thisWeek: number;
    lastWeek: number;
    changeAmount: number; // thisWeek - lastWeek (negative = spent less = good)
    changePct: number;    // percentage change (negative = improvement)
    trend: 'improving' | 'worsening' | 'stable';
};

/** Returns the Monday 00:00 of the week containing the given date */
function mondayOf(d: Date): Date {
    const day = d.getDay(); // 0=Sun
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
}

/** Returns a short label like "Feb 24" */
function weekLabel(monday: Date): string {
    return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Returns week ranges for the last N weeks (oldest first) */
function getLast4Weeks(): Array<{ start: Date; end: Date; label: string }> {
    const thisMonday = mondayOf(new Date());
    const ranges = [];
    for (let i = 3; i >= 0; i--) {
        const start = new Date(thisMonday);
        start.setDate(start.getDate() - i * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        ranges.push({ start, end, label: weekLabel(start) });
    }
    return ranges;
}

/** Sums transaction amounts within a date range [start, end) */
function sumInRange(transactions: Transaction[], start: Date, end: Date): number {
    return transactions
        .filter(tx => {
            const d = new Date(tx.timestamp);
            return d >= start && d < end;
        })
        .reduce((s, tx) => s + tx.amount, 0);
}

/**
 * Computes the weekly report for the last 4 weeks.
 * Pure function — no API calls, no async.
 */
export function computeWeeklyReport(transactions: Transaction[]): WeeklyReport {
    const ranges = getLast4Weeks();

    const weeks: WeekData[] = ranges.map(r => ({
        label: r.label,
        start: r.start,
        end: r.end,
        total: sumInRange(transactions, r.start, r.end),
    }));

    const thisWeek = weeks[3].total;
    const lastWeek = weeks[2].total;
    const changeAmount = thisWeek - lastWeek;

    const changePct = lastWeek > 0
        ? Math.round((changeAmount / lastWeek) * 100)
        : 0;

    // Spending LESS is "improving"
    let trend: WeeklyReport['trend'] = 'stable';
    if (changePct < -5) trend = 'improving';
    else if (changePct > 5) trend = 'worsening';

    return { weeks, thisWeek, lastWeek, changeAmount, changePct, trend };
}
