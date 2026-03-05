import 'react-native-url-polyfill/auto';
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { computeHealthScore, HealthScore } from '../utils/healthScore';
import { loadCheckinData } from '../components/WeeklyCheckin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type Transaction = {
    id: string;
    amount: number;
    vendor_name: string;
    inferred_category: string;
    timestamp: string;
};

export type Category = {
    id: string;
    name: string;
    icon?: string;
    user_id: string | null; // null = global/default
};

export type BudgetSettings = {
    dailyLimit: number;
    monthlyLimit: number;
    categoryLimits: Record<string, number>;
};

type AppContextType = {
    transactions: Transaction[];
    addTransactions: (txs: Array<{ amount: number; vendor?: string; vendor_name?: string; inferred_category?: string }>) => Promise<void>;
    updateTransaction: (id: string, updates: { amount?: number; vendor_name?: string; inferred_category?: string }) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
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
};

const defaultBudget: BudgetSettings = {
    dailyLimit: 50,
    monthlyLimit: 1500,
    categoryLimits: {},
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(defaultBudget);
    const [userId, setUserId] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [weeklyBonus, setWeeklyBonusState] = useState<number>(0);

    const setWeeklyBonus = useCallback((bonus: number) => {
        setWeeklyBonusState(bonus);
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserId(session.user.id);
                fetchTransactions();
                fetchCategories();
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            if (uid) {
                fetchTransactions();
                fetchCategories();
            } else {
                setTransactions([]);
                setCategories([]);
            }
        });

        AsyncStorage.getItem('budget_settings').then(raw => {
            if (raw) setBudgetSettings(JSON.parse(raw));
        });

        // Load weekly check-in bonus
        loadCheckinData().then(data => {
            if (data) setWeeklyBonusState(data.weeklyBonus);
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchTransactions = async () => {
        const { data, error } = await supabase
            .from('transactions')
            .select('id, amount, vendor_name, raw_transcript, timestamp')
            .order('timestamp', { ascending: false })
            .limit(200);

        if (error) { console.error("Error fetching transactions:", error); return; }
        setTransactions((data || []).map(row => ({
            id: row.id,
            amount: Number(row.amount),
            vendor_name: row.vendor_name,
            inferred_category: row.raw_transcript || 'Other',
            timestamp: row.timestamp,
        })));
    };

    // Fetch global + user categories
    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name, icon, user_id')
            .order('name', { ascending: true });

        if (error) { console.error("Error fetching categories:", error); return; }
        setCategories(data || []);
    };

    const addTransactions = useCallback(async (
        txs: Array<{ amount: number; vendor?: string; vendor_name?: string; inferred_category?: string }>
    ) => {
        if (!userId) { console.error("Must be authenticated to save transactions"); return; }

        await supabase.from('users').upsert({ id: userId }, { onConflict: 'id' });

        // ── Auto-create any unknown categories ────────────────────────────────
        // Fetch latest categories from state (categories is in closure)
        const knownNames = new Set(categories.map(c => c.name.toLowerCase()));

        // Collect unique new category names from incoming transactions
        const newCats = [...new Set(
            txs
                .map(tx => tx.inferred_category ?? 'Other')
                .filter(cat => cat && cat !== 'Other' && !knownNames.has(cat.toLowerCase()))
        )];

        // Simple name → icon heuristic
        const guessIcon = (name: string): string => {
            const n = name.toLowerCase();
            if (/food|dining|restaurant|cafe|coffee|pizza/.test(n)) return 'Utensils';
            if (/market|grocery|supermarket|store/.test(n)) return 'ShoppingCart';
            if (/transport|taxi|uber|lyft|gas|fuel|car/.test(n)) return 'Car';
            if (/gym|fitness|sport|health|medical|vet|hospital/.test(n)) return 'Dumbbell';
            if (/entertain|movie|cinema|netflix|game/.test(n)) return 'Film';
            if (/travel|flight|hotel|airbnb/.test(n)) return 'Plane';
            if (/book|school|education|course/.test(n)) return 'Book';
            if (/music|concert|spotify/.test(n)) return 'Music';
            if (/utility|electric|water|internet|phone/.test(n)) return 'Lightbulb';
            if (/shop|cloth|amazon|mall/.test(n)) return 'ShoppingBag';
            return 'Package';
        };

        // Create new categories sequentially (to avoid race conditions)
        for (const catName of newCats) {
            const icon = guessIcon(catName);
            await supabase.from('categories').insert({ user_id: userId, name: catName, icon });
        }
        if (newCats.length > 0) await fetchCategories();

        const inserts = txs.map(tx => ({
            user_id: userId,
            amount: tx.amount,
            vendor_name: tx.vendor_name ?? tx.vendor ?? 'Unknown',
            raw_transcript: tx.inferred_category ?? 'Other',
        }));

        const { error } = await supabase.from('transactions').insert(inserts);
        if (error) { console.error("Failed to insert transactions:", error); return; }
        await fetchTransactions();
    }, [userId, categories]);

    const createCategory = useCallback(async (name: string, icon?: string) => {
        if (!userId) return;
        await supabase.from('users').upsert({ id: userId }, { onConflict: 'id' });
        const { error } = await supabase.from('categories').insert({ user_id: userId, name, icon });
        if (error) { console.error("Failed to create category:", error); return; }
        await fetchCategories();
    }, [userId]);

    const updateCategory = useCallback(async (id: string, name: string, icon?: string) => {
        const { error } = await supabase.from('categories').update({ name, icon }).eq('id', id);
        if (error) { console.error("Failed to update category:", error); return; }
        await fetchCategories();
    }, []);

    const deleteCategory = useCallback(async (id: string) => {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) { console.error("Failed to delete category:", error); return; }
        await fetchCategories();
    }, []);

    const updateTransaction = useCallback(async (id: string, updates: { amount?: number; vendor_name?: string; inferred_category?: string }) => {
        const payload: any = {};
        if (updates.amount !== undefined) payload.amount = updates.amount;
        if (updates.vendor_name !== undefined) payload.vendor_name = updates.vendor_name;
        if (updates.inferred_category !== undefined) payload.raw_transcript = updates.inferred_category;

        const { error } = await supabase.from('transactions').update(payload).eq('id', id);
        if (error) { console.error("Failed to update transaction:", error); return; }
        await fetchTransactions();
    }, []);

    const deleteTransaction = useCallback(async (id: string) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) { console.error("Failed to delete transaction:", error); return; }
        await fetchTransactions();
    }, []);

    const saveBudgetSettings = useCallback(async (s: BudgetSettings) => {
        setBudgetSettings(s);
        await AsyncStorage.setItem('budget_settings', JSON.stringify(s));
    }, []);

    const getDailyTotal = useCallback((dateStr: string) => {
        return transactions
            .filter(tx => tx.timestamp.slice(0, 10) === dateStr)
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
            transactions, addTransactions, updateTransaction, deleteTransaction,
            budgetSettings, saveBudgetSettings, getDailyTotal,
            healthScore, weeklyBonus, setWeeklyBonus,
            userId, signOut,
            categories, createCategory, updateCategory, deleteCategory,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp must be inside AppProvider");
    return ctx;
}
