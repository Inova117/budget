import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { WeeklyReport } from '../utils/weeklyReport';
import { useApp } from '../context/AppContext';

type Props = {
    report: WeeklyReport;
};

export default function WeeklyReportCard({ report }: Props) {
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? dark : light;
    const { formatMoney: fmt } = useApp();
    const formatMoney = (n: number) => fmt(Math.abs(n));

    const { weeks, thisWeek, changeAmount, changePct, trend } = report;

    // Color: green if spending less (improving), red if more (worsening)
    const changeColor =
        trend === 'improving' ? '#30d158' :
            trend === 'worsening' ? '#ff453a' :
                theme.muted;

    const trendLabel =
        trend === 'improving' ? '↓ Decreasing' :
            trend === 'worsening' ? '↑ Increasing' :
                '→ Stable';

    // Bar chart calculations
    const maxTotal = Math.max(...weeks.map(w => w.total), 1);

    return (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.label, { color: theme.muted }]}>THIS WEEK</Text>
                <Text style={[styles.trendBadge, { color: changeColor }]}>
                    {trendLabel}
                </Text>
            </View>

            {/* Main amount */}
            <Text style={[styles.mainAmount, { color: theme.fg }]}>
                {formatMoney(thisWeek)}
            </Text>

            {/* Change vs last week */}
            <Text style={[styles.change, { color: changeColor }]}>
                {changeAmount >= 0 ? '+' : '−'}{formatMoney(changeAmount)}{' '}
                <Text style={styles.changePct}>
                    ({changeAmount >= 0 ? '+' : ''}{changePct}% vs last week)
                </Text>
            </Text>

            {/* Mini bar chart — 4 weeks */}
            <View style={styles.chartRow}>
                {weeks.map((w, i) => {
                    const heightPct = maxTotal > 0 ? w.total / maxTotal : 0;
                    const isCurrentWeek = i === weeks.length - 1;
                    return (
                        <View key={w.label} style={styles.barCol}>
                            <View style={styles.barTrack}>
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: `${Math.max(heightPct * 100, 2)}%`,
                                            backgroundColor: isCurrentWeek
                                                ? changeColor
                                                : theme.barInactive,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.barLabel, { color: theme.muted }]}>
                                {isCurrentWeek ? 'Now' : w.label.split(' ')[1]}
                            </Text>
                            {isCurrentWeek && (
                                <Text style={[styles.barAmount, { color: theme.muted }]}>
                                    {formatMoney(w.total)}
                                </Text>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const light = {
    card: '#fff', fg: '#111', muted: '#888', barInactive: '#e5e5e5',
};
const dark = {
    card: '#111', fg: '#f0f0f0', muted: '#555', barInactive: '#2a2a2a',
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        gap: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 3,
    },
    trendBadge: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    mainAmount: {
        fontSize: 36,
        fontWeight: '200',
        letterSpacing: -1,
        marginTop: 2,
    },
    change: {
        fontSize: 13,
        fontWeight: '500',
    },
    changePct: {
        fontWeight: '400',
    },
    chartRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: 12,
        height: 72,
    },
    barCol: {
        flex: 1,
        alignItems: 'center',
        height: '100%',
        gap: 4,
    },
    barTrack: {
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
        borderRadius: 4,
        overflow: 'hidden',
    },
    bar: {
        width: '100%',
        borderRadius: 4,
    },
    barLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    barAmount: {
        fontSize: 9,
    },
});
