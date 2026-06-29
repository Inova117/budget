import { Transaction, BudgetSettings } from '../context/AppContext';

export type HealthScore = {
    score: number;       // 0–100
    grade: 'EXCELLENT' | 'CAUTION' | 'ATTENTION';
    label: string;
};

/**
 * Computes a 0–100 financial health score from existing app data.
 * No API calls — pure local calculation.
 *
 * Factors:
 *   50%  Budget adherence  — how much of monthly limit has been spent
 *   30%  Weekly consistency — stability of spending week-over-week
 *   20%  Category discipline — % of limited categories still within budget
 *
 * weeklyBonus: adjustment (-15 to +15) from the weekly check-in answers
 */
export function computeHealthScore(
    transactions: Transaction[],
    budgetSettings: BudgetSettings,
    weeklyBonus: number = 0
): HealthScore {
    const now = new Date();

    // ── Helper: ISO week start (Monday) ─────────────────────────────────────
    const startOfWeek = (d: Date): Date => {
        const day = d.getDay(); // 0=Sun
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
    };

    // ── Month boundaries ─────────────────────────────────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySpend = transactions
        .filter(tx => new Date(tx.timestamp) >= monthStart)
        .reduce((s, tx) => s + tx.amount, 0);

    // ── Weekly spend ─────────────────────────────────────────────────────────
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    const thisWeekSpend = transactions
        .filter(tx => new Date(tx.timestamp) >= thisWeekStart)
        .reduce((s, tx) => s + tx.amount, 0);

    const lastWeekSpend = transactions
        .filter(tx => {
            const d = new Date(tx.timestamp);
            return d >= lastWeekStart && d < lastWeekEnd;
        })
        .reduce((s, tx) => s + tx.amount, 0);

    // ── Category spend (keyed by category_id, matching budget limits) ─────────
    const categoryLimits = budgetSettings.categoryLimits; // keyed by category_id
    const limitedCategories = Object.keys(categoryLimits).filter(k => categoryLimits[k] > 0);

    const categorySpend: Record<string, number> = {};
    transactions
        .filter(tx => new Date(tx.timestamp) >= monthStart)
        .forEach(tx => {
            if (tx.category_id) categorySpend[tx.category_id] = (categorySpend[tx.category_id] || 0) + tx.amount;
        });

    // ── Factor 1: Budget adherence (50%) ─────────────────────────────────────
    let budgetFactor = 100; // default: full score if no limit set
    if (budgetSettings.monthlyLimit > 0) {
        const usedRatio = monthlySpend / budgetSettings.monthlyLimit;
        // Score drops as ratio approaches 1. Exceeding = 0.
        budgetFactor = Math.max(0, Math.round((1 - usedRatio) * 100));
    }

    // ── Factor 2: Weekly consistency (30%) ───────────────────────────────────
    let consistencyFactor = 100; // default: perfect if no prior week data
    if (lastWeekSpend > 0 && thisWeekSpend > 0) {
        // % change; cap at 100% increase = 0 score
        const changePct = Math.abs(thisWeekSpend - lastWeekSpend) / lastWeekSpend;
        consistencyFactor = Math.max(0, Math.round((1 - Math.min(changePct, 1)) * 100));
    }

    // ── Factor 3: Category discipline (20%) ──────────────────────────────────
    let categoryFactor = 100; // default: perfect if no categories configured
    if (limitedCategories.length > 0) {
        const withinLimit = limitedCategories.filter(cat => {
            const spent = categorySpend[cat] || 0;
            return spent <= categoryLimits[cat];
        });
        categoryFactor = Math.round((withinLimit.length / limitedCategories.length) * 100);
    }

    // ── Weighted average ──────────────────────────────────────────────────────
    const hasMonthlyLimit = budgetSettings.monthlyLimit > 0;
    const hasCategoryLimits = limitedCategories.length > 0;

    let score: number;
    if (hasMonthlyLimit && hasCategoryLimits) {
        score = Math.round(budgetFactor * 0.5 + consistencyFactor * 0.3 + categoryFactor * 0.2);
    } else if (hasMonthlyLimit) {
        score = Math.round(budgetFactor * 0.65 + consistencyFactor * 0.35);
    } else if (hasCategoryLimits) {
        score = Math.round(categoryFactor * 0.65 + consistencyFactor * 0.35);
    } else {
        // No limits set at all — only consistency matters
        score = consistencyFactor;
    }

    score = Math.max(0, Math.min(100, score + weeklyBonus));

    // ── Grade + color ─────────────────────────────────────────────────────────
    if (score >= 80) {
        return { score, grade: 'EXCELLENT', label: 'Excellent' };
    } else if (score >= 50) {
        return { score, grade: 'CAUTION', label: 'Caution' };
    } else {
        return { score, grade: 'ATTENTION', label: 'Attention' };
    }
}
