import React, { useMemo } from 'react';
import { View, StyleSheet, Text, useColorScheme } from 'react-native';
import { useApp } from '../context/AppContext';
import { localDayKey } from '../utils/dates';

type DotColor = 'none' | 'within' | 'slightly_over' | 'over';

interface SpendingHeatmapProps {
    categoryId?: string | null;
}

export default function SpendingHeatmap({ categoryId = null }: SpendingHeatmapProps) {
    const { transactions, budgetSettings, categoryById } = useApp();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const categoryName = categoryId ? categoryById.get(categoryId)?.name ?? null : null;

    // Build 31-day grid (e.g. 7 columns of 5, or just wrap in flex)
    const grid = useMemo(() => {
        const DAYS = 31;
        const today = new Date();
        const days: Array<{ date: string; status: DotColor }> = [];

        // Go back 30 days so today is the 31st dot
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - DAYS + 1);

        for (let i = 0; i < DAYS; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = localDayKey(d);

            // Calculate total for this specific day (local calendar)
            const dayTotal = transactions
                .filter(tx => localDayKey(tx.timestamp) === dateStr)
                .filter(tx => (categoryId ? tx.category_id === categoryId : true))
                .reduce((sum, tx) => sum + tx.amount, 0);

            // Daily threshold derived from the monthly (or per-category) limit.
            const limit = categoryId && budgetSettings.categoryLimits[categoryId]
                ? budgetSettings.categoryLimits[categoryId] / 30
                : budgetSettings.monthlyLimit / 30;

            let status: DotColor = 'none';
            // Only color by budget when one is actually set (else everything reads "over").
            if (dayTotal > 0) {
                if (limit <= 0) {
                    status = 'within';
                } else {
                    const ratio = dayTotal / limit;
                    if (ratio <= 1.0) status = 'within';
                    else if (ratio <= 1.5) status = 'slightly_over';
                    else status = 'over';
                }
            }

            days.push({ date: dateStr, status });
        }

        return days;
    }, [transactions, budgetSettings, categoryId]);

    const dotColor = (status: DotColor) => {
        switch (status) {
            case 'within': return '#4ade80'; // green
            case 'slightly_over': return '#facc15'; // yellow
            case 'over': return '#f87171'; // red
            default: return isDark ? '#1f1f1f' : '#e5e5e5'; // empty
        }
    };

    return (
        <View style={styles.wrapper}>
            <Text style={[styles.title, { color: isDark ? '#666' : '#aaa' }]}>
                {categoryName ? `${categoryName.toUpperCase()} — 31 DAYS` : 'SPENDING PULSE — 31 DAYS'}
            </Text>

            {/* We use flexWrap to allow the 31 dots to neatly wrap depending on screen width */}
            <View style={styles.grid}>
                {grid.map((day, ri) => (
                    <View
                        key={ri}
                        style={[styles.dot, { backgroundColor: dotColor(day.status) }]}
                    />
                ))}
            </View>

            {/* Legend */}
            {!categoryId && (
                <View style={styles.legend}>
                    {(['none', 'within', 'slightly_over', 'over'] as DotColor[]).map(s => (
                        <View key={s} style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: dotColor(s) }]} />
                            <Text style={[styles.legendText, { color: isDark ? '#555' : '#aaa' }]}>
                                {s === 'none' ? 'No spend' : s === 'within' ? 'On track' : s === 'slightly_over' ? 'Warning' : 'Over limit'}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const DOT = 14; // Make dots slightly larger for the 31-day view
const GAP = 5;

const styles = StyleSheet.create({
    wrapper: { width: '100%', paddingHorizontal: 10 },
    title: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 16, textAlign: 'center' },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
        justifyContent: 'center',
        paddingHorizontal: 20
    },
    dot: { width: DOT, height: DOT, borderRadius: DOT / 2 }, // Perfect circles
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendText: { fontSize: 10 },
});
