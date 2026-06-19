import 'react-native-url-polyfill/auto';
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { computeHealthScore, HealthScore } from '../utils/healthScore';
import { loadCheckinData } from '../components/WeeklyCheckin';
import { localDayKey } from '../utils/dates';
import { formatMoney as fmtMoney, CurrencyCode } from '../utils/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Items parsed with less confidence than this are flagged needs_review (PRD §3).
export const CONFIDENCE_THRESHOLD = 0.85;

export type Transaction = {
    id: string;
    amount: number;
    vendor_name: string;
    category_id: string | null;
    inferred_category: string;   // derived: category name (FK) or legacy raw_transcript
    transcript: string | null;   // the actual spoken/typed text (for the habit engine)
    needs_review: boolean;
    timestamp: string;
};

export type Category = {
    id: string;
    name: string;
    icon?: string;
    user_id: string | null; // null = global/default
};

export type LearningRule = {
    id: string;
    vendor_pattern: string;        // normalized (lowercase, trimmed) vendor
    enforced_category_id: string;
};

export type BudgetSettings = {
    dailyLimit: number;
    monthlyLimit: number;
    categoryLimits: Record<string, number>;
};

/** Shape accepted when adding expenses (from AI, confirm modal, or manual). */
export type ExpenseInput = {
    amount: number;
    vendor?: string;
    vendor_name?: string;
    inferred_category?: string;
    confidence?: number;
};

type AppContextType = {
    transactions: Transaction[];
    addTransactions: (txs: ExpenseInput[], opts?: { transcript?: string }) => Promise<void>;
    updateTransaction: (id: string, updates: { amount?: number; vendor_name?: string; inferred_category?: string }) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    refresh: () => Promise<void>;
    budgetSettings: BudgetSettings;
    saveBudgetSettings: (s: BudgetSettings) => Promise<void>;
    getDailyTotal: (dateStr: string) => number;
    healthScore: HealthScore;
    weeklyBonus: number;
    setWeeklyBonus: (bonus: number) => void;
    userId: string | null;
    signOut: () => Promise<void>;
    // Categories
    categories: Category[];
    createCategory: (name: string, icon?: string) => Promise<void>;
    updateCategory: (id: string, name: string, icon?: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    // Habit learning
    applyLearningRules: <T extends ExpenseInput>(expenses: T[]) => T[];
    // Currency
    currency: CurrencyCode;
    setCurrency: (c: CurrencyCode) => Promise<void>;
    formatMoney: (n: number) => string;
};

const defaultBudget: BudgetSettings = {
    dailyLimit: 50,
    monthlyLimit: 1500,
    categoryLimits: {},
};

const AppContext = createContext<AppContextType | null>(null);

// Name → lucide icon name heuristic for auto-created categories.
function guessIcon(name: string): string {
    const n = name.toLowerCase();
    if (/food|dining|restaurant|cafe|coffee|pizza|comida/.test(n)) return 'Utensils';
    if (/market|grocery|supermarket|store|super|mercado/.test(n)) return 'ShoppingCart';
    if (/transport|taxi|uber|lyft|gas|fuel|car|combustible/.test(n)) return 'Car';
    if (/gym|fitness|sport|health|medical|vet|hospital|salud/.test(n)) return 'Dumbbell';
    if (/entertain|movie|cinema|netflix|game|cine/.test(n)) return 'Film';
    if (/travel|flight|hotel|airbnb|viaje/.test(n)) return 'Plane';
    if (/book|school|education|course|libro/.test(n)) return 'Book';
    if (/music|concert|spotify/.test(n)) return 'Music';
    if (/utility|electric|water|internet|phone|luz|agua/.test(n)) return 'Lightbulb';
    if (/shop|cloth|amazon|mall|ropa/.test(n)) return 'ShoppingBag';
    return 'Package';
}

const normalizeVendor = (v: string) => v.toLowerCase().trim();

// Map the AI's generic fallbacks to the existing global "Miscellaneous" bucket
// so we don't mint a per-user "Other" category (which would proliferate toward
// the 50-category cap and fragment analytics).
const MISC_ALIASES = new Set(['other', 'others', 'otro', 'otros', 'misc', 'varios', 'miscelaneo', 'misceláneo']);
const canonicalCategory = (name: string): string => {
    const n = (name ?? '').trim();
    return MISC_ALIASES.has(n.toLowerCase()) ? 'Miscellaneous' : n;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(defaultBudget);
    const [userId, setUserId] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [learningRules, setLearningRules] = useState<LearningRule[]>([]);
    const [weeklyBonus, setWeeklyBonusState] = useState<number>(0);
    const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
    const [prefs, setPrefs] = useState<Record<string, any>>({});

    const setWeeklyBonus = useCallback((bonus: number) => {
        setWeeklyBonusState(bonus);
    }, []);

    const fetchCategories = useCallback(async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name, icon, user_id')
            .order('name', { ascending: true });
        if (error) { console.error('Error fetching categories:', error); return; }
        setCategories(data || []);
    }, []);

    const fetchTransactions = useCallback(async () => {
        const { data, error } = await supabase
            .from('transactions')
            .select('id, amount, vendor_name, category_id, raw_transcript, needs_review, timestamp, category:categories(name)')
            .order('timestamp', { ascending: false })
            .limit(200);
        if (error) { console.error('Error fetching transactions:', error); return; }
        setTransactions((data || []).map(rowToTransaction));
    }, []);

    const fetchLearningRules = useCallback(async () => {
        const { data, error } = await supabase
            .from('learning_rules')
            .select('id, vendor_pattern, enforced_category_id');
        if (error) { console.error('Error fetching learning rules:', error); return; }
        setLearningRules(data || []);
    }, []);

    const fetchPreferences = useCallback(async (uid: string) => {
        const { data, error } = await supabase
            .from('users')
            .select('preferences')
            .eq('id', uid)
            .maybeSingle();
        if (error) { console.error('Error fetching preferences:', error); return; }
        const p = (data?.preferences as Record<string, any>) ?? {};
        setPrefs(p);
        if (p.currency) setCurrencyState(p.currency);
    }, []);

    const loadAll = useCallback((uid: string) => {
        fetchTransactions();
        fetchCategories();
        fetchLearningRules();
        fetchPreferences(uid);
    }, [fetchTransactions, fetchCategories, fetchLearningRules, fetchPreferences]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserId(session.user.id);
                loadAll(session.user.id);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            // Initial restore is handled by getSession() above; here we only react
            // to NEW sign-ins and sign-outs (not token refreshes) to avoid a
            // redundant double-load on cold start.
            if (event === 'SIGNED_IN') {
                if (uid) loadAll(uid);
            } else if (event === 'SIGNED_OUT') {
                setTransactions([]);
                setCategories([]);
                setLearningRules([]);
                setCurrencyState('USD');
            }
        });

        AsyncStorage.getItem('budget_settings').then(raw => {
            if (raw) setBudgetSettings(JSON.parse(raw));
        });

        loadCheckinData().then(data => {
            if (data) setWeeklyBonusState(data.weeklyBonus);
        });

        return () => subscription.unsubscribe();
    }, [loadAll]);

    // ── Category id resolution (auto-creates unknown categories) ───────────────
    const resolveCategoryIds = useCallback(async (names: string[]): Promise<Map<string, string>> => {
        const map = new Map<string, string>();
        categories.forEach(c => map.set(c.name.toLowerCase(), c.id));

        const toCreate = [...new Set(
            names
                .map(n => canonicalCategory(n ?? 'Other'))
                .filter(n => n && !map.has(n.toLowerCase()))
        )];

        for (const name of toCreate) {
            const { data, error } = await supabase
                .from('categories')
                .insert({ user_id: userId, name, icon: guessIcon(name) })
                .select('id, name')
                .single();
            if (error) { console.error('Failed to create category:', error.message); continue; }
            if (data) map.set(data.name.toLowerCase(), data.id);
        }
        if (toCreate.length) await fetchCategories();
        return map;
    }, [categories, userId, fetchCategories]);

    const addTransactions = useCallback(async (txs: ExpenseInput[], opts?: { transcript?: string }) => {
        if (!userId) { console.error('Must be authenticated to save transactions'); return; }
        if (!txs.length) return;

        const catMap = await resolveCategoryIds(txs.map(tx => tx.inferred_category ?? 'Other'));

        const inserts = txs.map(tx => {
            const name = canonicalCategory(tx.inferred_category ?? 'Other');
            const conf = typeof tx.confidence === 'number' ? tx.confidence : 1;
            return {
                user_id: userId,
                amount: tx.amount,
                vendor_name: tx.vendor_name ?? tx.vendor ?? 'Unknown',
                category_id: catMap.get(name.toLowerCase()) ?? null,
                raw_transcript: opts?.transcript ?? null,
                needs_review: conf < CONFIDENCE_THRESHOLD,
            };
        });

        const { data, error } = await supabase
            .from('transactions')
            .insert(inserts)
            .select('id, amount, vendor_name, category_id, raw_transcript, needs_review, timestamp, category:categories(name)');
        if (error) { console.error('Failed to insert transactions:', error); return; }

        // Optimistic merge — no full refetch. Dedupe by id and keep the same
        // 200-row window fetchTransactions uses so in-memory state can't drift.
        const fresh = (data || []).map(rowToTransaction);
        setTransactions(prev => {
            const ids = new Set(fresh.map(f => f.id));
            return [...fresh, ...prev.filter(t => !ids.has(t.id))]
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 200);
        });
    }, [userId, resolveCategoryIds]);

    const createCategory = useCallback(async (name: string, icon?: string) => {
        if (!userId) return;
        const { error } = await supabase.from('categories').insert({ user_id: userId, name, icon });
        if (error) { console.error('Failed to create category:', error); return; }
        await fetchCategories();
    }, [userId, fetchCategories]);

    const updateCategory = useCallback(async (id: string, name: string, icon?: string) => {
        const { error } = await supabase.from('categories').update({ name, icon }).eq('id', id);
        if (error) { console.error('Failed to update category:', error); return; }
        await fetchCategories();
        await fetchTransactions(); // names are derived from the FK join
    }, [fetchCategories, fetchTransactions]);

    const deleteCategory = useCallback(async (id: string) => {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) { console.error('Failed to delete category:', error); return; }
        await fetchCategories();
        await fetchTransactions();
    }, [fetchCategories, fetchTransactions]);

    const updateTransaction = useCallback(async (
        id: string,
        updates: { amount?: number; vendor_name?: string; inferred_category?: string }
    ) => {
        const payload: Record<string, unknown> = {};
        if (updates.amount !== undefined) payload.amount = updates.amount;
        if (updates.vendor_name !== undefined) payload.vendor_name = updates.vendor_name;

        const existing = transactions.find(t => t.id === id);

        let newCatId: string | undefined;
        if (updates.inferred_category !== undefined) {
            const map = await resolveCategoryIds([updates.inferred_category]);
            newCatId = map.get(canonicalCategory(updates.inferred_category).toLowerCase());
            payload.category_id = newCatId ?? null;
        }

        const { error } = await supabase.from('transactions').update(payload).eq('id', id);
        if (error) { console.error('Failed to update transaction:', error); return; }

        // Habit learning: remember vendor → category corrections, but only when
        // the category actually CHANGED (don't re-teach on an amount-only edit).
        const categoryChanged = newCatId !== undefined && newCatId !== existing?.category_id;
        const vendor = updates.vendor_name ?? existing?.vendor_name;
        if (categoryChanged && newCatId && vendor && normalizeVendor(vendor)) {
            await supabase.from('learning_rules').upsert(
                { user_id: userId, vendor_pattern: normalizeVendor(vendor), enforced_category_id: newCatId },
                { onConflict: 'user_id,vendor_pattern' }
            );
            fetchLearningRules();
        }

        await fetchTransactions();
    }, [transactions, userId, resolveCategoryIds, fetchLearningRules, fetchTransactions]);

    const deleteTransaction = useCallback(async (id: string) => {
        setTransactions(prev => prev.filter(t => t.id !== id)); // optimistic
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) { console.error('Failed to delete transaction:', error); await fetchTransactions(); }
    }, [fetchTransactions]);

    const refresh = useCallback(async () => {
        await Promise.all([fetchTransactions(), fetchCategories(), fetchLearningRules()]);
    }, [fetchTransactions, fetchCategories, fetchLearningRules]);

    const applyLearningRules = useCallback(<T extends ExpenseInput>(expenses: T[]): T[] => {
        if (!learningRules.length) return expenses;
        const catById = new Map(categories.map(c => [c.id, c.name]));
        const ruleByVendor = new Map(learningRules.map(r => [r.vendor_pattern, r.enforced_category_id]));
        return expenses.map(e => {
            const v = normalizeVendor(e.vendor ?? e.vendor_name ?? '');
            const catId = v ? ruleByVendor.get(v) : undefined;
            const name = catId ? catById.get(catId) : undefined;
            return name ? { ...e, inferred_category: name } : e;
        });
    }, [learningRules, categories]);

    const setCurrency = useCallback(async (c: CurrencyCode) => {
        setCurrencyState(c);
        if (!userId) return;
        // Merge into existing preferences so we don't clobber timezone / future keys.
        const merged = { ...prefs, currency: c };
        setPrefs(merged);
        const { error } = await supabase.from('users').update({ preferences: merged }).eq('id', userId);
        if (error) console.error('Failed to save currency:', error);
    }, [userId, prefs]);

    const formatMoney = useCallback((n: number) => fmtMoney(n, currency), [currency]);

    const saveBudgetSettings = useCallback(async (s: BudgetSettings) => {
        setBudgetSettings(s);
        await AsyncStorage.setItem('budget_settings', JSON.stringify(s));
    }, []);

    const getDailyTotal = useCallback((dateStr: string) => {
        return transactions
            .filter(tx => localDayKey(tx.timestamp) === dateStr)
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [transactions]);

    const healthScore = useMemo(
        () => computeHealthScore(transactions, budgetSettings, weeklyBonus),
        [transactions, budgetSettings, weeklyBonus]
    );

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    return (
        <AppContext.Provider value={{
            transactions, addTransactions, updateTransaction, deleteTransaction, refresh,
            budgetSettings, saveBudgetSettings, getDailyTotal,
            healthScore, weeklyBonus, setWeeklyBonus,
            userId, signOut,
            categories, createCategory, updateCategory, deleteCategory,
            applyLearningRules,
            currency, setCurrency, formatMoney,
        }}>
            {children}
        </AppContext.Provider>
    );
}

// Maps a DB row to a Transaction, deriving the category name from the FK join
// while staying backward-compatible with legacy rows (category name was stored
// in raw_transcript and category_id is NULL).
function rowToTransaction(row: any): Transaction {
    const catName: string | null = row.category?.name ?? null;
    const hasCategoryId = !!row.category_id;
    return {
        id: row.id,
        amount: Number(row.amount),
        vendor_name: row.vendor_name,
        category_id: row.category_id ?? null,
        inferred_category: catName ?? (hasCategoryId ? 'Uncategorized' : (row.raw_transcript || 'Uncategorized')),
        transcript: hasCategoryId ? (row.raw_transcript ?? null) : null,
        needs_review: !!row.needs_review,
        timestamp: row.timestamp,
    };
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be inside AppProvider');
    return ctx;
}
