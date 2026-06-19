import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme, TouchableOpacity, LayoutAnimation } from 'react-native';
import { ShoppingCart, Utensils, Car, Film, Lightbulb, Heart, Plane, Droplet, ShoppingBag, Home, Package, Gamepad2, Dumbbell, Music, Book, Briefcase } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import SpendingHeatmap from '../components/SpendingHeatmap';
import WeeklyCheckin, { loadCheckinData, isCheckinDue, thisWeekMonday } from '../components/WeeklyCheckin';
import WeeklyReportCard from '../components/WeeklyReportCard';
import FilterBar from '../components/FilterBar';
import { computeWeeklyReport } from '../utils/weeklyReport';
import { periodStart as periodStartUtil, localDayKey, Period } from '../utils/dates';

const ICON_MAP: Record<string, any> = {
    ShoppingCart, Utensils, Car, Film, Lightbulb, Heart, Plane, Droplet,
    ShoppingBag, Home, Package, Gamepad2, Dumbbell, Music, Book, Briefcase
};

function getIconComponent(iconName?: string) {
    return ICON_MAP[iconName || ''] || Package;
}

const CATEGORY_COLORS: Record<string, string> = {
    Dining: '#f97316',
    Groceries: '#22c55e',
    Transportation: '#3b82f6',
    Entertainment: '#a855f7',
    Shopping: '#ec4899',
    Utilities: '#14b8a6',
    Healthcare: '#ef4444',
    Other: '#94a3b8',
};

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function periodLabel(period: Period): string {
    switch (period) {
        case 'today': return 'TODAY';
        case 'week': return 'THIS WEEK';
        case 'month': return 'THIS MONTH';
        case 'all': return 'ALL TIME';
    }
}

export default function DashboardScreen() {
    const { transactions, categories, weeklyBonus, setWeeklyBonus, formatMoney } = useApp();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? dark : light;

    const [period, setPeriod] = useState<Period>('month');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [showCheckin, setShowCheckin] = useState(false);

    // Reset expanded category when filter changes
    const handlePeriodChange = (p: Period) => {
        setExpandedCategory(null);
        setPeriod(p);
    };

    // Check if weekly check-in is due on mount
    useEffect(() => {
        const monday = thisWeekMonday();
        const hasTransactionsThisWeek = transactions.some(
            tx => localDayKey(tx.timestamp) >= monday
        );
        if (!hasTransactionsThisWeek) return;

        loadCheckinData().then(data => {
            if (isCheckinDue(data)) {
                setTimeout(() => setShowCheckin(true), 600);
            }
        });
    }, []);

    const toggleCategory = (cat: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCategory(expandedCategory === cat ? null : cat);
    };

    // ── Filtered transactions (drives all downstream calculations) ────────────
    const filteredTxs = useMemo(() => {
        const start = periodStartUtil(period);
        return transactions.filter(tx => new Date(tx.timestamp) >= start);
    }, [transactions, period]);

    // ── Category breakdown ────────────────────────────────────────────────────
    const categoryTotals = useMemo(() => {
        const map: Record<string, number> = {};
        filteredTxs.forEach(tx => {
            map[tx.inferred_category] = (map[tx.inferred_category] || 0) + tx.amount;
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
    }, [filteredTxs]);

    const maxCategory = categoryTotals[0]?.[1] || 1;

    // ── Period total ──────────────────────────────────────────────────────────
    const periodTotal = useMemo(() =>
        filteredTxs.reduce((s, tx) => s + tx.amount, 0),
        [filteredTxs]
    );

    // ── Grouped by date (for recent list) ────────────────────────────────────
    const groupedByDate = useMemo(() => {
        const groups: Record<string, typeof transactions> = {};
        filteredTxs.slice(0, 50).forEach(tx => {
            const day = localDayKey(tx.timestamp);
            if (!groups[day]) groups[day] = [];
            groups[day].push(tx);
        });
        return Object.entries(groups).slice(0, 14);
    }, [filteredTxs]);

    // ── Weekly report (always uses full transactions — time-agnostic) ─────────
    const weeklyReport = useMemo(() => computeWeeklyReport(transactions), [transactions]);

    return (
        <>
            {/* ── Period filter bar — above the scroll ── */}
            <FilterBar value={period} onChange={handlePeriodChange} />

            <ScrollView
                style={{ flex: 1, backgroundColor: theme.bg }}
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* Period Summary */}
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <Text style={[styles.cardLabel, { color: theme.muted }]}>{periodLabel(period)}</Text>
                    <Text style={[styles.cardAmount, { color: theme.fg }]}>{formatMoney(periodTotal)}</Text>
                    <View style={styles.cardFooter}>
                        <Text style={[styles.cardSub, { color: theme.muted }]}>
                            {filteredTxs.length} transaction{filteredTxs.length !== 1 ? 's' : ''}
                        </Text>
                        <TouchableOpacity onPress={() => setShowCheckin(true)}>
                            <Text style={[
                                styles.bonusBadge,
                                {
                                    color: weeklyBonus > 0
                                        ? '#30d158'
                                        : weeklyBonus < 0
                                            ? '#ff453a'
                                            : theme.muted
                                }
                            ]}>
                                {weeklyBonus > 0
                                    ? `+${weeklyBonus} pts this week`
                                    : weeklyBonus < 0
                                        ? `${weeklyBonus} pts this week`
                                        : 'Weekly check-in →'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Weekly Report — only visible in week/month/all view */}
                {period !== 'today' && (
                    <>
                        <Text style={[styles.sectionTitle, { color: theme.fg }]}>WEEKLY TREND</Text>
                        <WeeklyReportCard report={weeklyReport} />
                    </>
                )}

                {/* Category Breakdown */}
                {categoryTotals.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: theme.fg }]}>BY CATEGORY</Text>
                        <View style={[styles.card, { backgroundColor: theme.card }]}>
                            {categoryTotals.map(([cat, total]) => (
                                <View key={cat}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => toggleCategory(cat)}
                                        style={[styles.catRow, expandedCategory === cat && { marginBottom: 16 }]}
                                    >
                                        <View style={styles.catMeta}>
                                            {(() => {
                                                const category = categories.find(c => c.name === cat);
                                                const IconComponent = getIconComponent(category?.icon);
                                                return (
                                                    <View style={styles.catIconContainer}>
                                                        <IconComponent size={16} color={theme.fg} strokeWidth={1.5} />
                                                    </View>
                                                );
                                            })()}
                                            <Text style={[styles.catName, { color: theme.fg }]}>{cat}</Text>
                                        </View>
                                        <View style={styles.barContainer}>
                                            <View
                                                style={[
                                                    styles.bar,
                                                    {
                                                        backgroundColor: CATEGORY_COLORS[cat] || '#94a3b8',
                                                        width: `${(total / maxCategory) * 100}%`,
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={[styles.catAmount, { color: theme.muted }]}>{formatMoney(total)}</Text>
                                    </TouchableOpacity>

                                    {expandedCategory === cat && (
                                        <View style={{ marginBottom: 20 }}>
                                            <SpendingHeatmap categoryFilter={cat} />
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* Recent Transactions */}
                {groupedByDate.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: theme.fg }]}>TRANSACTIONS</Text>
                        {groupedByDate.map(([day, txs]) => (
                            <View key={day} style={{ marginBottom: 16 }}>
                                <Text style={[styles.dayHeader, { color: theme.muted }]}>{formatDate(txs[0].timestamp)}</Text>
                                <View style={[styles.card, { backgroundColor: theme.card }]}>
                                    {txs.map((tx, i) => (
                                        <View
                                            key={tx.id}
                                            style={[
                                                styles.txRow,
                                                { borderBottomColor: theme.border },
                                                i < txs.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth }
                                            ]}
                                        >
                                            {(() => {
                                                const category = categories.find(c => c.name === tx.inferred_category);
                                                const IconComponent = getIconComponent(category?.icon);
                                                return (
                                                    <View style={styles.txIconContainer}>
                                                        <IconComponent size={14} color={theme.muted} strokeWidth={1.5} />
                                                    </View>
                                                );
                                            })()}
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.txVendor, { color: theme.fg }]}>{tx.vendor_name}</Text>
                                                <Text style={[styles.txCat, { color: theme.muted }]}>{tx.inferred_category}</Text>
                                            </View>
                                            <Text style={[styles.txAmt, { color: theme.fg }]}>{formatMoney(tx.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* Empty state */}
                {filteredTxs.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: theme.muted }]}>
                            No transactions {period === 'today' ? 'today' : period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'yet'}
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Weekly Check-in Modal */}
            <WeeklyCheckin
                visible={showCheckin}
                onComplete={(bonus) => {
                    setWeeklyBonus(bonus);
                    setShowCheckin(false);
                }}
                onDismiss={() => setShowCheckin(false)}
            />
        </>
    );
}

const light = { bg: '#f5f5f5', fg: '#111', muted: '#888', card: '#fff', border: '#eee' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', card: '#111', border: '#222' };

const styles = StyleSheet.create({
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    card: { borderRadius: 16, padding: 16, marginBottom: 8, gap: 12 },
    cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3 },
    cardAmount: { fontSize: 40, fontWeight: '200', letterSpacing: -1 },
    cardSub: { fontSize: 12 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bonusBadge: { fontSize: 12, fontWeight: '600' },
    sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginTop: 20, marginBottom: 10 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    catMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 110 },
    catIconContainer: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    catDot: { width: 8, height: 8, borderRadius: 4 },
    catName: { fontSize: 13, fontWeight: '400' },
    barContainer: { flex: 1, height: 6, backgroundColor: '#e5e5e510', borderRadius: 3, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: 3 },
    catAmount: { fontSize: 12, width: 60, textAlign: 'right' },
    dayHeader: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginBottom: 6 },
    txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    txIconContainer: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
    txVendor: { fontSize: 14, fontWeight: '500' },
    txCat: { fontSize: 11, marginTop: 1 },
    txAmt: { fontSize: 14, fontWeight: '300' },
    emptyState: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { fontSize: 14, fontWeight: '400' },
});
