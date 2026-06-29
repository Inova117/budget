import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
    TextInput, useColorScheme, Animated,
} from 'react-native';
import { Check, X, ChevronDown } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { currencySymbol } from '../utils/format';

export type PendingExpense = {
    amount: number;
    vendor: string;
    vendor_name?: string;
    inferred_category: string;
    confidence?: number; // 0..1 from the AI; < 0.85 is flagged for review
};

const REVIEW_THRESHOLD = 0.85;

type Props = {
    visible: boolean;
    expenses: PendingExpense[];
    transcript?: string;
    categoryOptions: string[];
    onConfirm: (expenses: PendingExpense[]) => void;
    onDiscard: () => void;
};

function ExpenseRow({
    expense,
    index,
    categoryOptions,
    theme,
    symbol,
    amountText,
    onChangeAmount,
    onChange,
}: {
    expense: PendingExpense;
    index: number;
    categoryOptions: string[];
    theme: any;
    symbol: string;
    amountText: string;
    onChangeAmount: (text: string) => void;
    onChange: (updated: PendingExpense) => void;
}) {
    const [showCatPicker, setShowCatPicker] = useState(false);
    const lowConfidence = typeof expense.confidence === 'number' && expense.confidence < REVIEW_THRESHOLD;
    // Include the AI's (possibly invented) category in the list so it's not lost
    // after the first tap on a different category.
    const inferred = expense.inferred_category;
    const opts = inferred && !categoryOptions.includes(inferred) ? [inferred, ...categoryOptions] : categoryOptions;

    return (
        <View style={[styles.expenseRow, { borderColor: lowConfidence ? '#f5a623' : theme.border }]}>
            {/* Amount */}
            <View style={styles.rowSection}>
                <View style={styles.labelRow}>
                    <Text style={[styles.fieldLabel, { color: theme.muted }]}>AMOUNT</Text>
                    {lowConfidence && (
                        <View style={styles.reviewTag}>
                            <View style={styles.reviewDot} />
                            <Text style={styles.reviewTagText}>CHECK</Text>
                        </View>
                    )}
                </View>
                <View style={[styles.inputWrap, { borderColor: expense.amount > 0 ? theme.border : '#ff3b30' }]}>
                    <Text style={[styles.currencySign, { color: theme.muted }]}>{symbol}</Text>
                    <TextInput
                        style={[styles.input, { color: theme.fg }]}
                        keyboardType="decimal-pad"
                        value={amountText}
                        onChangeText={onChangeAmount}
                        placeholder="0.00"
                        placeholderTextColor={theme.muted}
                        selectTextOnFocus
                    />
                </View>
            </View>

            {/* Vendor */}
            <View style={styles.rowSection}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>VENDOR</Text>
                <View style={[styles.inputWrap, { borderColor: theme.border }]}>
                    <TextInput
                        style={[styles.input, { color: theme.fg }]}
                        value={expense.vendor || expense.vendor_name || ''}
                        onChangeText={v => onChange({ ...expense, vendor: v, vendor_name: v })}
                        placeholder="Store or description"
                        placeholderTextColor={theme.muted}
                    />
                </View>
            </View>

            {/* Category */}
            <View style={styles.rowSection}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>CATEGORY</Text>
                <TouchableOpacity
                    style={[styles.inputWrap, styles.catButton, { borderColor: theme.border }]}
                    onPress={() => setShowCatPicker(!showCatPicker)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.input, { color: theme.fg, flex: 1 }]}>
                        {expense.inferred_category || 'Other'}
                    </Text>
                    <ChevronDown size={14} color={theme.muted} strokeWidth={2} />
                </TouchableOpacity>

                {showCatPicker && (
                    <View style={[styles.catList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        {opts.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.catOption,
                                    { borderBottomColor: theme.border },
                                    cat === expense.inferred_category && { backgroundColor: theme.fg + '15' },
                                ]}
                                onPress={() => {
                                    onChange({ ...expense, inferred_category: cat });
                                    setShowCatPicker(false);
                                }}
                            >
                                <Text style={[styles.catOptionText, { color: theme.fg }]}>{cat}</Text>
                                {cat === expense.inferred_category && (
                                    <Check size={12} color={theme.fg} strokeWidth={2.5} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

export default function ExpenseConfirmModal({
    visible,
    expenses: initialExpenses,
    transcript,
    categoryOptions,
    onConfirm,
    onDiscard,
}: Props) {
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? dark : light;
    const { currency } = useApp();
    const symbol = currencySymbol(currency);

    const [local, setLocal] = useState<PendingExpense[]>(initialExpenses);
    // Raw text per amount field, so "12." / "12.50" don't get mangled mid-typing.
    const [amountTexts, setAmountTexts] = useState<string[]>([]);

    // Sync when new expenses come in
    React.useEffect(() => {
        setLocal(initialExpenses);
        setAmountTexts(initialExpenses.map(e => (e.amount > 0 ? String(e.amount) : '')));
    }, [initialExpenses, visible]);

    const updateExpense = (index: number, updated: PendingExpense) => {
        setLocal(prev => prev.map((e, i) => i === index ? updated : e));
    };

    const changeAmount = (index: number, text: string) => {
        const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
        setAmountTexts(prev => prev.map((t, i) => i === index ? cleaned : t));
        const n = parseFloat(cleaned);
        setLocal(prev => prev.map((e, i) => i === index ? { ...e, amount: Number.isFinite(n) ? n : 0 } : e));
    };

    const hasExpenses = local.length > 0;
    const canSave = hasExpenses && local.every(e => e.amount > 0);

    return (
        <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen">
            <View style={styles.overlay}>
                <View style={[styles.sheet, { backgroundColor: theme.card }]}>
                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: theme.fg }]}>
                            {hasExpenses ? `${local.length} expense${local.length > 1 ? 's' : ''} detected` : 'Nothing detected'}
                        </Text>
                        <TouchableOpacity onPress={onDiscard} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={20} color={theme.muted} strokeWidth={2} />
                        </TouchableOpacity>
                    </View>

                    {/* Transcript (always shown for transparency) */}
                    {transcript ? (
                        <View style={[styles.transcriptBox, { backgroundColor: theme.bg }]}>
                            <Text style={[styles.transcriptLabel, { color: theme.muted }]}>HEARD</Text>
                            <Text style={[styles.transcriptText, { color: theme.muted }]} numberOfLines={3}>
                                "{transcript}"
                            </Text>
                        </View>
                    ) : null}

                    {/* Expense rows */}
                    {hasExpenses ? (
                        <ScrollView
                            style={styles.scroll}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {local.map((expense, i) => (
                                <ExpenseRow
                                    key={i}
                                    expense={expense}
                                    index={i}
                                    categoryOptions={categoryOptions}
                                    theme={theme}
                                    symbol={symbol}
                                    amountText={amountTexts[i] ?? ''}
                                    onChangeAmount={text => changeAmount(i, text)}
                                    onChange={updated => updateExpense(i, updated)}
                                />
                            ))}
                        </ScrollView>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyText, { color: theme.muted }]}>
                                No expenses were found in your recording.{'\n'}Try speaking clearly, e.g. "Gasté treinta dólares en el súper."
                            </Text>
                        </View>
                    )}

                    {/* Point-of-output AI-accuracy notice (shown right where the user
                        relies on the result, before they save). */}
                    {hasExpenses && (
                        <Text style={[styles.aiNote, { color: theme.muted }]}>
                            AI can make mistakes. Check each amount, vendor and category before saving.
                        </Text>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.discardBtn, { borderColor: theme.border }]}
                            onPress={onDiscard}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.btnText, { color: theme.muted }]}>Discard</Text>
                        </TouchableOpacity>
                        {hasExpenses && (
                            <TouchableOpacity
                                style={[styles.btn, styles.confirmBtn, { backgroundColor: theme.fg, opacity: canSave ? 1 : 0.4 }]}
                                onPress={() => canSave && onConfirm(local)}
                                disabled={!canSave}
                                activeOpacity={0.8}
                            >
                                <Check size={16} color={theme.card} strokeWidth={2.5} />
                                <Text style={[styles.btnText, { color: theme.card }]}>
                                    {canSave ? 'Save All' : 'Enter amounts'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const light = { bg: '#f5f5f5', fg: '#111', muted: '#888', card: '#fff', border: '#e5e5e5' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', card: '#1a1a1a', border: '#2a2a2a' };

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '85%',
        gap: 16,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '300',
        letterSpacing: -0.3,
    },
    transcriptBox: {
        borderRadius: 12,
        padding: 12,
        gap: 4,
    },
    transcriptLabel: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 2.5,
    },
    transcriptText: {
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    scroll: {
        maxHeight: 320,
    },
    expenseRow: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        gap: 12,
    },
    rowSection: {
        gap: 4,
    },
    fieldLabel: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 2,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reviewTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reviewDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#f5a623',
    },
    reviewTagText: {
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 1.5,
        color: '#f5a623',
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42,
    },
    currencySign: {
        fontSize: 16,
        fontWeight: '300',
        marginRight: 4,
    },
    input: {
        fontSize: 16,
        fontWeight: '300',
        flex: 1,
        height: '100%',
    },
    catButton: {
        justifyContent: 'space-between',
    },
    catList: {
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 4,
        zIndex: 999,
    },
    catOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    catOptionText: {
        fontSize: 14,
        fontWeight: '400',
    },
    emptyState: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
    aiNote: {
        fontSize: 11,
        lineHeight: 16,
        textAlign: 'center',
        marginTop: -4,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    btn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    discardBtn: {
        borderWidth: 1,
    },
    confirmBtn: {},
    btnText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
