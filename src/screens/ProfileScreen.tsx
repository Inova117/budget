import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TouchableOpacity, useColorScheme, Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';
import { useConfirm, useToast } from '../components/FeedbackProvider';
import { localMonthKey } from '../utils/dates';
import { CURRENCIES } from '../utils/format';
import { supabase } from '../lib/supabase';

const MONTHLY_MAX = 5000;

export default function ProfileScreen() {
    const {
        budgetSettings, setMonthlyLimit, setCategoryLimit, signOut, transactions, categories,
        currency, setCurrency, formatMoney,
    } = useApp();
    const confirm = useConfirm();
    const toast = useToast();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? dark : light;

    const [monthly, setMonthly] = useState(budgetSettings.monthlyLimit);
    // Transient slider values while dragging (cleared on release). Source of
    // truth stays budgetSettings so nothing goes stale.
    const [draft, setDraft] = useState<Record<string, number>>({});

    // Sync the local slider value when the budget loads/changes elsewhere.
    useEffect(() => {
        setMonthly(budgetSettings.monthlyLimit);
    }, [budgetSettings.monthlyLimit]);

    const limitFor = (id: string) => draft[id] ?? budgetSettings.categoryLimits[id] ?? 0;
    const saveCatLimit = async (id: string, v: number) => {
        await setCategoryLimit(id, v);
        setDraft(prev => { const n = { ...prev }; delete n[id]; return n; });
        flashSaved();
    };

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

    const saveMonthly = async (v: number) => {
        await setMonthlyLimit(v);
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

    // Spent this month per category_id (drives the per-category progress).
    const catSpentById = useMemo(() => {
        const m: Record<string, number> = {};
        transactions
            .filter(tx => localMonthKey(tx.timestamp) === thisMonth)
            .forEach(tx => { if (tx.category_id) m[tx.category_id] = (m[tx.category_id] || 0) + tx.amount; });
        return m;
    }, [transactions, thisMonth]);

    // How much of the monthly cap is split across categories.
    const allocated = useMemo(
        () => Object.values(budgetSettings.categoryLimits).reduce((s, v) => s + v, 0),
        [budgetSettings.categoryLimits]
    );
    const overAllocated = monthly > 0 && allocated > monthly;

    // ── "Safe to spend today" = remaining budget / days left in the month ─────
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
    const remaining = Math.max(0, monthly - monthlySpend);
    const safeToday = monthly > 0 ? remaining / daysLeft : 0;

    const handleDeleteAccount = async () => {
        const ok = await confirm({
            title: 'Delete account?',
            message: 'This permanently deletes your account and all your data. This cannot be undone.',
            confirmLabel: 'Delete account',
            destructive: true,
        });
        if (!ok) return;
        try {
            const { error } = await supabase.functions.invoke('delete-account');
            if (error) throw error;
            toast.success('Account deleted');
            await signOut();
        } catch (e: any) {
            toast.error(e?.message || 'Could not delete account. Try again.');
        }
    };

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
                Set your monthly cap, then split it across categories. Saves automatically.
            </Text>

            {/* Safe to spend today */}
            {monthly > 0 && (
                <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
                    <Text style={[styles.heroLabel, { color: theme.muted }]}>SAFE TO SPEND TODAY</Text>
                    <Text style={[styles.heroValue, { color: theme.fg }]}>{formatMoney(safeToday)}</Text>
                    <Text style={[styles.heroSub, { color: theme.muted }]}>
                        {formatMoney(remaining)} left · {daysLeft} day{daysLeft !== 1 ? 's' : ''} to go
                    </Text>
                </View>
            )}

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
                    onSlidingComplete={v => saveMonthly(v)}
                    minimumTrackTintColor={isDark ? '#f0f0f0' : '#111'}
                    maximumTrackTintColor={isDark ? '#2a2a2a' : '#e5e5e5'}
                    thumbTintColor={isDark ? '#ffffff' : '#111111'}
                />
                <View style={styles.sliderRange}>
                    <Text style={[styles.sliderRangeText, { color: theme.muted }]}>{formatMoney(0)}</Text>
                    <Text style={[styles.sliderRangeText, { color: theme.muted }]}>{formatMoney(MONTHLY_MAX)}</Text>
                </View>
            </View>

            {/* By category — split the monthly cap */}
            <View style={styles.catSectionHeader}>
                <Text style={[styles.section, { color: theme.muted, marginTop: 20 }]}>BY CATEGORY</Text>
                {monthly > 0 && (
                    <Text style={[styles.allocLabel, { color: overAllocated ? '#ff3b30' : theme.muted }]}>
                        {formatMoney(allocated)} of {formatMoney(monthly)}
                        {overAllocated ? ' · over' : ` · ${formatMoney(Math.max(monthly - allocated, 0))} left`}
                    </Text>
                )}
            </View>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
                {categories.length === 0 && (
                    <Text style={[styles.progressLabel, { color: theme.muted }]}>No categories yet.</Text>
                )}
                {categories.map((cat, i) => {
                    const limit = limitFor(cat.id);
                    const spent = catSpentById[cat.id] ?? 0;
                    const ratio = limit > 0 ? spent / limit : 0;
                    const over = ratio > 1;
                    // Scale is FIXED (0…monthly) so other sliders never shift. The
                    // cap is enforced by clamping THIS slider to what's left for it:
                    // its own share + the still-unallocated remainder.
                    const persisted = budgetSettings.categoryLimits[cat.id] ?? 0;
                    const allocatedOthers = allocated - persisted;
                    // The wall is "what's left for others" PLUS this category's own
                    // current value, so an over-allocated category isn't forced to 0
                    // just by touching its slider (it can still be reduced).
                    const allowedMax = monthly > 0 ? Math.max(0, monthly - allocatedOthers) : 1000;
                    const wall = Math.max(allowedMax, persisted);
                    const sliderMax = monthly > 0 ? monthly : 1000;
                    return (
                        <View key={cat.id}>
                            <View style={styles.sliderHeader}>
                                <Text style={[styles.sliderLabel, { color: theme.fg }]}>{cat.name}</Text>
                                <Text style={[styles.sliderValue, { color: limit > 0 ? theme.fg : theme.muted }]}>
                                    {limit > 0 ? formatMoney(limit) : 'No limit'}
                                </Text>
                            </View>
                            {limit > 0 && (
                                <>
                                    <View style={styles.progressOuter}>
                                        <View style={[styles.progressInner, {
                                            width: `${Math.min(ratio * 100, 100)}%`,
                                            backgroundColor: over ? '#ff3b30' : (isDark ? '#f0f0f0' : '#111'),
                                            opacity: over ? 1 : Math.max(0.2, Math.min(ratio, 1)),
                                        }]} />
                                    </View>
                                    <Text style={[styles.progressLabel, { color: over ? '#ff3b30' : theme.muted }]}>
                                        {formatMoney(spent)} of {formatMoney(limit)}{over ? '  · over' : ''}
                                    </Text>
                                </>
                            )}
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={sliderMax}
                                upperLimit={wall}
                                step={10}
                                value={Math.min(limit, wall)}
                                disabled={wall <= 0}
                                onValueChange={v => setDraft(prev => ({ ...prev, [cat.id]: Math.min(v, wall) }))}
                                onSlidingComplete={v => saveCatLimit(cat.id, Math.min(v, wall))}
                                minimumTrackTintColor={isDark ? '#f0f0f0' : '#111'}
                                maximumTrackTintColor={isDark ? '#2a2a2a' : '#e5e5e5'}
                                thumbTintColor={isDark ? '#ffffff' : '#111111'}
                            />
                            {i < categories.length - 1 && (
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

            {/* Delete account (required by app stores for accounts) */}
            <TouchableOpacity
                style={styles.deleteAccountBtn}
                onPress={handleDeleteAccount}
                activeOpacity={0.7}
            >
                <Text style={styles.deleteAccountText}>Delete Account</Text>
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
    heroCard: { borderRadius: 16, padding: 20, marginTop: 4, marginBottom: 8, alignItems: 'center', gap: 4 },
    heroLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3 },
    heroValue: { fontSize: 44, fontWeight: '200', letterSpacing: -1.5 },
    heroSub: { fontSize: 12 },
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
    catSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    allocLabel: { fontSize: 11, fontWeight: '500', marginBottom: 10 },
    currencyRow: { gap: 8, paddingVertical: 2 },
    currencyChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
    currencyCode: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
    signOutBtn: { marginTop: 32, alignItems: 'center', paddingVertical: 12 },
    signOutText: { fontSize: 13, fontWeight: '400' },
    deleteAccountBtn: { marginTop: 4, alignItems: 'center', paddingVertical: 12 },
    deleteAccountText: { fontSize: 13, fontWeight: '400', color: '#ff3b30' },
});
