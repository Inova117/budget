import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TouchableOpacity, useColorScheme, Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp, BudgetSettings } from '../context/AppContext';
import { localMonthKey } from '../utils/dates';
import { CURRENCIES } from '../utils/format';

const MONTHLY_MAX = 5000;
const CATEGORY_MAX = 1000;

export default function ProfileScreen() {
    const {
        budgetSettings, saveBudgetSettings, signOut, transactions, categories,
        currency, setCurrency, formatMoney,
    } = useApp();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? dark : light;

    // Use categories from context, fall back to a base list
    const CATEGORIES = categories.length > 0
        ? categories.map(c => c.name)
        : ['Groceries', 'Dining', 'Transportation', 'Entertainment', 'Shopping', 'Utilities', 'Healthcare', 'Other'];

    const [monthly, setMonthly] = useState(budgetSettings.monthlyLimit);
    const [catLimits, setCatLimits] = useState<Record<string, number>>(
        Object.fromEntries(CATEGORIES.map(c => [c, budgetSettings.categoryLimits[c] || 0]))
    );

    // Sync when context loads
    useEffect(() => {
        setMonthly(budgetSettings.monthlyLimit);
        setCatLimits(Object.fromEntries(CATEGORIES.map(c => [c, budgetSettings.categoryLimits[c] || 0])));
    }, [budgetSettings]);

    // ── Saved feedback ────────────────────────────────────────────────────────
    const [savedVisible, setSavedVisible] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flashSaved = () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSavedVisible(true);
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(1500),
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setSavedVisible(false));
    };

    // ── Auto-save helpers ─────────────────────────────────────────────────────
    const doSave = async (newMonthly: number, newCatLimits: Record<string, number>) => {
        const parsed: BudgetSettings = {
            dailyLimit: newMonthly / 30,
            monthlyLimit: newMonthly,
            categoryLimits: Object.fromEntries(
                Object.entries(newCatLimits).filter(([, v]) => v > 0)
            ),
        };
        await saveBudgetSettings(parsed);
        flashSaved();
    };

    // ── Monthly spending this month (local calendar) ──────────────────────────
    const thisMonth = localMonthKey(new Date());
    const monthlySpend = useMemo(() =>
        transactions
            .filter(tx => localMonthKey(tx.timestamp) === thisMonth)
            .reduce((s, tx) => s + tx.amount, 0),
        [transactions, thisMonth]
    );

    // Per-category spend this month
    const catSpend = useMemo(() => {
        const map: Record<string, number> = {};
        transactions
            .filter(tx => localMonthKey(tx.timestamp) === thisMonth)
            .forEach(tx => {
                const cat = tx.inferred_category || 'Other';
                map[cat] = (map[cat] || 0) + tx.amount;
            });
        return map;
    }, [transactions, thisMonth]);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.bg }}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.titleRow}>
                <Text style={[styles.pageTitle, { color: theme.fg }]}>Budget</Text>
                {savedVisible && (
                    <Animated.Text style={[styles.savedBadge, { opacity: fadeAnim, color: theme.muted }]}>
                        ✓ Saved
                    </Animated.Text>
                )}
            </View>
            <Text style={[styles.pageSubtitle, { color: theme.muted }]}>
                Adjust limits below. Changes save automatically when you lift your finger.
            </Text>

            {/* Monthly Total */}
            <Text style={[styles.section, { color: theme.muted }]}>TOTAL MONTHLY LIMIT</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
                <View style={styles.sliderHeader}>
                    <Text style={[styles.sliderLabel, { color: theme.fg }]}>Monthly cap</Text>
                    <Text style={[styles.sliderValue, { color: theme.fg }]}>{formatMoney(monthly)}</Text>
                </View>

                {/* Progress bar */}
                {monthly > 0 && (
                    <View style={styles.progressOuter}>
                        <View
                            style={[
                                styles.progressInner,
                                {
                                    width: `${Math.min((monthlySpend / monthly) * 100, 100)}%`,
                                    backgroundColor: isDark ? '#f0f0f0' : '#111',
                                    opacity: Math.max(0.15, Math.min(monthlySpend / monthly, 1)),
                                }
                            ]}
                        />
                    </View>
                )}
                {monthly > 0 && (
                    <Text style={[styles.progressLabel, { color: theme.muted }]}>
                        {formatMoney(monthlySpend)} spent · {formatMoney(Math.max(monthly - monthlySpend, 0))} left
                    </Text>
                )}

                <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={MONTHLY_MAX}
                    step={25}
                    value={monthly}
                    onValueChange={setMonthly}
                    onSlidingComplete={v => doSave(v, catLimits)}
                    minimumTrackTintColor={isDark ? '#f0f0f0' : '#111'}
                    maximumTrackTintColor={isDark ? '#2a2a2a' : '#e5e5e5'}
                    thumbTintColor={isDark ? '#ffffff' : '#111111'}
                />
                <View style={styles.sliderRange}>
                    <Text style={[styles.sliderRangeText, { color: theme.muted }]}>{formatMoney(0)}</Text>
                    <Text style={[styles.sliderRangeText, { color: theme.muted }]}>{formatMoney(MONTHLY_MAX)}</Text>
                </View>
            </View>

            {/* Per-Category Limits */}
            <Text style={[styles.section, { color: theme.muted }]}>BY CATEGORY (OPTIONAL)</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
                {CATEGORIES.map((cat, i) => {
                    const limit = catLimits[cat] ?? 0;
                    const spent = catSpend[cat] ?? 0;
                    const ratio = limit > 0 ? spent / limit : 0;

                    return (
                        <View key={cat}>
                            <View style={styles.sliderHeader}>
                                <Text style={[styles.sliderLabel, { color: theme.fg }]}>{cat}</Text>
                                <Text style={[styles.sliderValue, { color: limit > 0 ? (isDark ? '#fff' : '#111') : theme.muted }]}>
                                    {limit > 0 ? formatMoney(limit) : 'No limit'}
                                </Text>
                            </View>

                            {/* Progress bar for category */}
                            {limit > 0 && (
                                <>
                                    <View style={styles.progressOuter}>
                                        <View
                                            style={[
                                                styles.progressInner,
                                                {
                                                    width: `${Math.min(ratio * 100, 100)}%`,
                                                    backgroundColor: isDark ? '#f0f0f0' : '#111',
                                                    opacity: Math.max(0.15, Math.min(ratio, 1)),
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.progressLabel, { color: theme.muted }]}>
                                        {formatMoney(spent)} of {formatMoney(limit)}
                                        {ratio > 1 ? '  ⚠ Over limit' : ''}
                                    </Text>
                                </>
                            )}

                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={CATEGORY_MAX}
                                step={10}
                                value={limit}
                                onValueChange={v => setCatLimits(prev => ({ ...prev, [cat]: v }))}
                                onSlidingComplete={v => {
                                    const updated = { ...catLimits, [cat]: v };
                                    setCatLimits(updated);
                                    doSave(monthly, updated);
                                }}
                                minimumTrackTintColor={isDark ? '#f0f0f0' : '#111'}
                                maximumTrackTintColor={isDark ? '#2a2a2a' : '#e5e5e5'}
                                thumbTintColor={isDark ? '#ffffff' : '#111111'}
                            />
                            {i < CATEGORIES.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Currency */}
            <Text style={[styles.section, { color: theme.muted }]}>CURRENCY</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyRow}>
                    {CURRENCIES.map(c => {
                        const active = c.code === currency;
                        return (
                            <TouchableOpacity
                                key={c.code}
                                onPress={() => setCurrency(c.code)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                accessibilityLabel={`${c.label} (${c.code})`}
                                style={[
                                    styles.currencyChip,
                                    { borderColor: active ? theme.fg : theme.border },
                                    active && { backgroundColor: isDark ? '#1f1f1f' : '#f0f0f0' },
                                ]}
                            >
                                <Text style={[styles.currencyCode, { color: active ? theme.fg : theme.muted }]}>
                                    {c.symbol} {c.code}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Sign Out */}
            <TouchableOpacity
                style={styles.signOutBtn}
                onPress={() => signOut()}
                activeOpacity={0.7}
            >
                <Text style={[styles.signOutText, { color: theme.muted }]}>Sign Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const light = { bg: '#f5f5f5', fg: '#111', muted: '#888', card: '#fff', border: '#eee' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', card: '#111', border: '#222' };

const styles = StyleSheet.create({
    scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    pageTitle: { fontSize: 28, fontWeight: '300', letterSpacing: -0.5 },
    savedBadge: { fontSize: 13, fontWeight: '600' },
    pageSubtitle: { fontSize: 13, lineHeight: 20, marginBottom: 24 },
    section: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10, marginTop: 20 },
    card: { borderRadius: 16, padding: 16, marginBottom: 8, gap: 4 },
    sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    sliderLabel: { fontSize: 15, fontWeight: '400' },
    sliderValue: { fontSize: 15, fontWeight: '300' },
    progressOuter: { height: 4, backgroundColor: '#e5e5e520', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
    progressInner: { height: '100%', borderRadius: 2 },
    progressLabel: { fontSize: 11, marginTop: 2, marginBottom: 2 },
    slider: { width: '100%', height: 36, marginTop: 4 },
    sliderRange: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
    sliderRangeText: { fontSize: 10 },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
    currencyRow: { gap: 8, paddingVertical: 2 },
    currencyChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
    currencyCode: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
    signOutBtn: { marginTop: 32, alignItems: 'center', paddingVertical: 12 },
    signOutText: { fontSize: 13, fontWeight: '400' },
});
