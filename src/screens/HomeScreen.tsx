import React from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
    useColorScheme, Animated, Modal, Pressable, TextInput
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../context/AppContext';
import SpendingHeatmap from '../components/SpendingHeatmap';
import HealthScoreBadge from '../components/HealthScoreBadge';
import ExpenseConfirmModal, { PendingExpense } from '../components/ExpenseConfirmModal';
import { supabase } from '../../supabase';

// ─── Audio parsing ─────────────────────────────────────────────────────────

async function parseExpensesFromFileUri(fileUri: string, categoryNames: string[]): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('process-audio', {
        body: { fileUri, categoryNames },
        headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) throw new Error(error.message);
    return data.expenses || [];
}

async function uploadAndParseAudio(uri: string, categoryNames: string[]): Promise<any> {
    const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const formData = new FormData();
    // @ts-ignore
    formData.append('metadata', JSON.stringify({ file: { mimeType: 'audio/mp4' } }), 'application/json');
    // @ts-ignore
    formData.append('file', { uri, name: 'expense.m4a', type: 'audio/mp4' });

    const uploadRes = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${GEMINI_API_KEY}`,
        { method: 'POST', body: formData }
    );
    const uploadText = await uploadRes.text();
    if (!uploadRes.ok) throw new Error("Upload failed: " + uploadText);

    const fileUri = JSON.parse(uploadText)?.file?.uri;
    if (!fileUri) throw new Error("No file URI from upload");

    return parseExpensesFromFileUri(fileUri, categoryNames);
}

// ─── Image / Receipt parsing ───────────────────────────────────────────────

async function parseExpensesFromImage(imageUri: string, categoryNames: string[]): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    const { data, error } = await supabase.functions.invoke('process-image', {
        body: { imageBase64: base64, categoryNames },
        headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) throw new Error(error.message);
    return data.expenses || [];
}

// ─── Component ────────────────────────────────────────────────────────────

export default function HomeScreen() {
    const { addTransactions, transactions, updateTransaction, deleteTransaction, categories, healthScore } = useApp();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? dark : light;

    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('Hold to speak');
    const [showImageMenu, setShowImageMenu] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editVendor, setEditVendor] = useState('');
    const [editCategory, setEditCategory] = useState('');

    // Voice confirm modal
    const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[]>([]);
    const [pendingTranscript, setPendingTranscript] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    // Quick text input fallback
    const [showTextInput, setShowTextInput] = useState(false);
    const [quickText, setQuickText] = useState('');

    // Track recording start time for minimum duration enforcement
    const recordingStartTime = useRef<number>(0);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const ripple1 = useRef(new Animated.Value(0)).current;
    const ripple2 = useRef(new Animated.Value(0)).current;

    // Camera button scale animation
    const camScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Audio.requestPermissionsAsync();
    }, []);

    useEffect(() => {
        let scaleAnim: Animated.CompositeAnimation;
        let rippleAnim: Animated.CompositeAnimation;
        if (recording) {
            scaleAnim = Animated.loop(Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
            ]));
            scaleAnim.start();

            const makeRipple = (val: Animated.Value, delay: number) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.parallel([
                            Animated.timing(val, { toValue: 1, duration: 1200, useNativeDriver: true }),
                        ]),
                        Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
                    ])
                );
            rippleAnim = Animated.parallel([makeRipple(ripple1, 0), makeRipple(ripple2, 600)]);
            rippleAnim.start();
        } else {
            Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
            ripple1.setValue(0);
            ripple2.setValue(0);
        }
        return () => { scaleAnim?.stop(); rippleAnim?.stop(); };
    }, [recording]);

    const startRecording = async () => {
        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(rec);
            recordingStartTime.current = Date.now();
            setStatusText('Listening...');
        } catch (err: any) {
            Alert.alert("Mic Error", err.message);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        // Enforce minimum 1.5s recording
        const elapsed = Date.now() - recordingStartTime.current;
        if (elapsed < 1500) {
            setStatusText('Hold longer to speak');
            setTimeout(() => setStatusText('Hold to speak'), 2200);
            return;
        }

        const rec = recording;
        setRecording(null);
        setIsProcessing(true);
        setStatusText('Processing with AI...');
        try {
            await rec.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            const uri = rec.getURI();
            if (!uri) throw new Error("No recording URI");

            const catNames = categories.map((c: any) => c.name);
            const result = await uploadAndParseAudio(uri, catNames);

            // result is { expenses, transcript } from updated edge function
            const expenses: PendingExpense[] = (Array.isArray(result) ? result : result.expenses || []).map((e: any) => ({
                ...e,
                vendor: e.vendor || e.vendor_name || 'Unknown',
                vendor_name: e.vendor || e.vendor_name || 'Unknown',
            }));
            const transcript: string = typeof result === 'object' && !Array.isArray(result) ? (result.transcript || '') : '';

            setPendingExpenses(expenses);
            setPendingTranscript(transcript);
            setShowConfirm(true);
            setStatusText('Hold to speak');
        } catch (e: any) {
            setStatusText('Error — try again');
            setTimeout(() => setStatusText('Hold to speak'), 3000);
            Alert.alert("Error", e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Image scanning handlers ───────────────────────────────────────────

    const handleScanImage = async (source: 'camera' | 'gallery') => {
        setShowImageMenu(false);

        // Request permissions
        if (source === 'camera') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission needed", "Camera permission is required to take a photo.");
                return;
            }
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission needed", "Photo library permission is required.");
                return;
            }
        }

        let result: ImagePicker.ImagePickerResult;
        if (source === 'camera') {
            result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.85,
                allowsEditing: true,
            });
        } else {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.85,
                allowsEditing: true,
            });
        }

        if (result.canceled || !result.assets?.[0]?.uri) return;

        const imageUri = result.assets[0].uri;
        setIsProcessing(true);
        setStatusText('Scanning receipt...');

        try {
            const catNames = categories.map((c: any) => c.name);
            const parsed = await parseExpensesFromImage(imageUri, catNames);

            if (parsed && parsed.length > 0) {
                // Normalize vendor field
                const normalized = parsed.map((tx: any) => ({
                    ...tx,
                    vendor_name: tx.vendor || tx.vendor_name || 'Unknown',
                }));
                await addTransactions(normalized);
                setStatusText(`✓ ${parsed.length} item${parsed.length > 1 ? 's' : ''} scanned!`);
            } else {
                setStatusText('No items found');
                Alert.alert("No Items Found", "Make sure the receipt is clearly visible and well-lit.");
            }
            setTimeout(() => setStatusText('Hold to speak'), 3500);
        } catch (e: any) {
            setStatusText('Scan failed');
            setTimeout(() => setStatusText('Hold to speak'), 3000);
            Alert.alert("Scan Error", e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const onCameraPress = () => {
        Animated.sequence([
            Animated.timing(camScale, { toValue: 0.88, duration: 90, useNativeDriver: true }),
            Animated.timing(camScale, { toValue: 1, duration: 90, useNativeDriver: true }),
        ]).start();
        setShowImageMenu(true);
    };

    // Today's total
    const today = new Date().toISOString().slice(0, 10);
    const todayTotal = transactions
        .filter(tx => tx.timestamp.slice(0, 10) === today)
        .reduce((s, tx) => s + tx.amount, 0);

    const todayTxs = transactions
        .filter(tx => tx.timestamp.slice(0, 10) === today)
        .slice(0, 5);

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Fixed header: Score badge + Price + Spending Pulse */}
            <View style={styles.fixedHeader}>
                <View style={styles.scoreRow}>
                    {/* Daily total (left) */}
                    <View style={styles.amountBlock}>
                        <Text style={[styles.amount, { color: theme.fg }]}>${todayTotal.toFixed(2)}</Text>
                        <Text style={[styles.sublabel, { color: theme.muted }]}>SPENT TODAY</Text>
                    </View>

                    {/* Health score badge (right) */}
                    <HealthScoreBadge healthScore={healthScore} />
                </View>

                {/* Heatmap - fixed below total */}
                <View style={styles.heatmapSection}>
                    <SpendingHeatmap />
                </View>
            </View>

            {/* Scrollable transactions box */}
            <ScrollView
                style={styles.txScrollContainer}
                contentContainerStyle={styles.txScrollContent}
                showsVerticalScrollIndicator={false}
            >
                {todayTxs.length > 0 ? (
                    <View style={[styles.todayList, { borderTopColor: theme.border }]}>
                        {todayTxs.map((tx) => (
                            <TouchableOpacity
                                key={tx.id}
                                style={[styles.txRow, { borderBottomColor: theme.border }]}
                                onPress={() => {
                                    setEditingTx(tx);
                                    setEditAmount(tx.amount.toString());
                                    setEditVendor(tx.vendor_name);
                                    setEditCategory(tx.inferred_category);
                                }}
                                activeOpacity={0.7}
                            >
                                <View>
                                    <Text style={[styles.txVendor, { color: theme.fg }]}>{tx.vendor_name}</Text>
                                    <Text style={[styles.txCat, { color: theme.muted }]}>{tx.inferred_category}</Text>
                                </View>
                                <Text style={[styles.txAmt, { color: theme.fg }]}>−${tx.amount.toFixed(2)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: theme.muted }]}>No transactions today</Text>
                    </View>
                )}
            </ScrollView>

            {/* ── FAB row: keyboard + mic + camera ── */}
            <View style={styles.fabRow}>
                {/* Keyboard / type button */}
                <View style={styles.camContainer}>
                    <TouchableOpacity
                        style={[
                            styles.camBtn,
                            {
                                borderColor: isProcessing ? theme.muted : theme.fg,
                                opacity: (isProcessing || !!recording) ? 0.4 : 1,
                            }
                        ]}
                        onPress={() => setShowTextInput(true)}
                        disabled={isProcessing || !!recording}
                        activeOpacity={0.75}
                    >
                        <View style={{ gap: 3, alignItems: 'flex-start' }}>
                            <View style={[styles.keyLine, { width: 16, backgroundColor: isProcessing ? theme.muted : theme.fg }]} />
                            <View style={[styles.keyLine, { width: 12, backgroundColor: isProcessing ? theme.muted : theme.fg }]} />
                            <View style={[styles.keyLine, { width: 14, backgroundColor: isProcessing ? theme.muted : theme.fg }]} />
                        </View>
                    </TouchableOpacity>
                    <Text style={[styles.camHint, { color: theme.muted }]}>Type</Text>
                </View>

                {/* Mic / voice button */}
                <View style={styles.fab}>
                    {[ripple1, ripple2].map((ripple, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.ripple,
                                {
                                    opacity: ripple.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] }),
                                    transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
                                    borderColor: '#ff3b30',
                                }
                            ]}
                        />
                    ))}
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity
                            style={[
                                styles.micBtn,
                                recording
                                    ? { backgroundColor: '#ff3b30', borderWidth: 0 }
                                    : isProcessing
                                        ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.muted }
                                        : { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.fg }
                            ]}
                            onPressIn={startRecording}
                            onPressOut={stopRecording}
                            activeOpacity={1}
                            disabled={isProcessing}
                        >
                            {(recording || isProcessing) && (
                                <View style={[
                                    styles.innerDot,
                                    { backgroundColor: recording ? '#fff' : theme.muted }
                                ]} />
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                    <Text style={[styles.hint, { color: theme.muted }]}>{statusText}</Text>
                </View>

                {/* Camera / receipt scan button */}
                <View style={styles.camContainer}>
                    <Animated.View style={{ transform: [{ scale: camScale }] }}>
                        <TouchableOpacity
                            style={[
                                styles.camBtn,
                                {
                                    borderColor: isProcessing ? theme.muted : theme.fg,
                                    opacity: isProcessing ? 0.4 : 1,
                                }
                            ]}
                            onPress={onCameraPress}
                            disabled={isProcessing || !!recording}
                            activeOpacity={0.75}
                        >
                            <View style={styles.camIconOuter}>
                                <View style={[styles.camIconInner, { borderColor: isProcessing ? theme.muted : theme.fg }]} />
                                <View style={[styles.camIconLens, { backgroundColor: isProcessing ? theme.muted : theme.fg }]} />
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                    <Text style={[styles.camHint, { color: theme.muted }]}>Scan</Text>
                </View>
            </View>

            {/* ── Transaction Edit Modal ── */}
            <Modal
                visible={!!editingTx}
                transparent
                animationType="slide"
                onRequestClose={() => setEditingTx(null)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setEditingTx(null)}
                >
                    <View style={[styles.editCard, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]} onStartShouldSetResponder={() => true}>
                        <Text style={[styles.editTitle, { color: theme.fg }]}>Edit Transaction</Text>

                        <Text style={[styles.editLabel, { color: theme.muted }]}>VENDOR</Text>
                        <TextInput
                            style={[styles.editInput, { color: theme.fg, borderColor: theme.border }]}
                            value={editVendor}
                            onChangeText={setEditVendor}
                            placeholder="Vendor name"
                            placeholderTextColor={theme.muted}
                        />

                        <Text style={[styles.editLabel, { color: theme.muted }]}>AMOUNT</Text>
                        <TextInput
                            style={[styles.editInput, { color: theme.fg, borderColor: theme.border }]}
                            value={editAmount}
                            onChangeText={setEditAmount}
                            placeholder="0.00"
                            placeholderTextColor={theme.muted}
                            keyboardType="decimal-pad"
                        />

                        <Text style={[styles.editLabel, { color: theme.muted }]}>CATEGORY</Text>
                        <ScrollView style={styles.categoryPicker} horizontal showsHorizontalScrollIndicator={false}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.categoryChip,
                                        { borderColor: editCategory === cat.name ? theme.fg : theme.border },
                                        editCategory === cat.name && { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }
                                    ]}
                                    onPress={() => setEditCategory(cat.name)}
                                >
                                    <Text style={[styles.categoryChipText, { color: editCategory === cat.name ? theme.fg : theme.muted }]}>
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.editActions}>
                            <TouchableOpacity
                                style={[styles.deleteBtn, { backgroundColor: '#ff3b30' }]}
                                onPress={() => {
                                    Alert.alert('Delete Transaction', 'Are you sure?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: async () => {
                                                await deleteTransaction(editingTx.id);
                                                setEditingTx(null);
                                            }
                                        }
                                    ]);
                                }}
                            >
                                <Text style={styles.deleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.fg }]}
                                onPress={async () => {
                                    const amount = parseFloat(editAmount);
                                    if (isNaN(amount) || amount <= 0) {
                                        Alert.alert('Invalid Amount', 'Please enter a valid amount.');
                                        return;
                                    }
                                    await updateTransaction(editingTx.id, {
                                        amount,
                                        vendor_name: editVendor.trim(),
                                        inferred_category: editCategory
                                    });
                                    setEditingTx(null);
                                }}
                            >
                                <Text style={[styles.saveBtnText, { color: theme.bg }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* ── Image source picker modal ── */}
            <Modal
                visible={showImageMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowImageMenu(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowImageMenu(false)}
                >
                    <View style={[styles.menuCard, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
                        <Text style={[styles.menuTitle, { color: theme.fg }]}>Scan Receipt</Text>
                        <Text style={[styles.menuSubtitle, { color: theme.muted }]}>
                            Choose an image source
                        </Text>

                        <TouchableOpacity
                            style={[styles.menuOption, { borderColor: theme.border }]}
                            onPress={() => handleScanImage('camera')}
                        >
                            <View style={[styles.menuOptionIcon, { borderColor: theme.fg }]}>
                                {/* mini camera shape */}
                                <View style={[styles.miniCamBody, { borderColor: theme.fg }]} />
                                <View style={[styles.miniCamLens, { backgroundColor: theme.fg }]} />
                            </View>
                            <View>
                                <Text style={[styles.menuOptionLabel, { color: theme.fg }]}>Take Photo</Text>
                                <Text style={[styles.menuOptionSub, { color: theme.muted }]}>
                                    Use your camera
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuOption, { borderColor: theme.border }]}
                            onPress={() => handleScanImage('gallery')}
                        >
                            <View style={[styles.menuOptionIcon, { borderColor: theme.fg }]}>
                                {/* mini gallery shape */}
                                <View style={[styles.miniGallery, { borderColor: theme.fg }]}>
                                    <View style={[styles.miniGalleryInner, { backgroundColor: theme.fg }]} />
                                </View>
                            </View>
                            <View>
                                <Text style={[styles.menuOptionLabel, { color: theme.fg }]}>Choose from Gallery</Text>
                                <Text style={[styles.menuOptionSub, { color: theme.muted }]}>
                                    Pick an existing photo
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setShowImageMenu(false)}
                        >
                            <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
            {/* ── Expense Confirm Modal (voice/image result) ── */}
            <ExpenseConfirmModal
                visible={showConfirm}
                expenses={pendingExpenses}
                transcript={pendingTranscript}
                categoryOptions={categories.map((c: any) => c.name)}
                onConfirm={(confirmed) => {
                    addTransactions(confirmed);
                    setShowConfirm(false);
                    setPendingExpenses([]);
                }}
                onDiscard={() => {
                    setShowConfirm(false);
                    setPendingExpenses([]);
                }}
            />

            {/* ── Quick Text Input Modal ── */}
            <Modal
                visible={showTextInput}
                transparent
                animationType="slide"
                onRequestClose={() => setShowTextInput(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowTextInput(false)}
                >
                    <View
                        style={[styles.editCard, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={[styles.editTitle, { color: theme.fg }]}>Add expense</Text>
                        <Text style={[styles.editLabel, { color: theme.muted }]}>DESCRIBE THE EXPENSE</Text>
                        <TextInput
                            style={[styles.editInput, { color: theme.fg, borderColor: theme.border }]}
                            value={quickText}
                            onChangeText={setQuickText}
                            placeholder='e.g. "$30 en el super" or "Taxi 15 dollars"'
                            placeholderTextColor={theme.muted}
                            autoFocus
                            multiline
                        />
                        <View style={styles.editActions}>
                            <TouchableOpacity
                                style={[styles.editBtn, { borderColor: theme.border, borderWidth: 1 }]}
                                onPress={() => { setShowTextInput(false); setQuickText(''); }}
                            >
                                <Text style={{ color: theme.muted, fontSize: 15 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editBtn, { backgroundColor: theme.fg }]}
                                onPress={async () => {
                                    if (!quickText.trim()) return;
                                    // Parse manually — extract amount and description
                                    const match = quickText.match(/(\d+([.,]\d+)?)/)
                                    const amount = match ? parseFloat(match[1].replace(',', '.')) : 0;
                                    const vendor = quickText.replace(/[$\d.,]+/g, '').trim() || 'Manual entry';
                                    setPendingExpenses([{ amount, vendor, vendor_name: vendor, inferred_category: 'Other' }]);
                                    setPendingTranscript(quickText);
                                    setQuickText('');
                                    setShowTextInput(false);
                                    setShowConfirm(true);
                                }}
                            >
                                <Text style={{ color: theme.bg, fontWeight: '600', fontSize: 15 }}>Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const light = { bg: '#fafafa', fg: '#111', muted: '#999', border: '#eee' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', border: '#1e1e1e' };

const styles = StyleSheet.create({
    container: { flex: 1 },
    fixedHeader: {
        paddingTop: 50,
        paddingHorizontal: 24,
        paddingBottom: 16,
        alignItems: 'center',
    },
    scoreRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    amountBlock: {
        alignItems: 'flex-start',
    },
    amount: { fontSize: 48, fontWeight: '200', letterSpacing: -2 },
    sublabel: { fontSize: 9, fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 },
    txScrollContainer: {
        flex: 1,
        marginHorizontal: 16,
        marginBottom: 140,
    },
    txScrollContent: {
        paddingBottom: 20,
    },
    todayList: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth },
    emptyState: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 14, fontWeight: '400' },
    txRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    txVendor: { fontSize: 14, fontWeight: '500' },
    txCat: { fontSize: 11, marginTop: 2 },
    txAmt: { fontSize: 14, fontWeight: '300' },
    heatmapSection: { width: '100%', marginTop: 8, marginBottom: 12 },

    // ── FAB row ──
    fabRow: {
        position: 'absolute',
        bottom: 32,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 28,
    },

    // Camera button
    camContainer: { alignItems: 'center', gap: 6 },
    camBtn: {
        width: 44, height: 44, borderRadius: 22,
        borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    camIconOuter: {
        width: 20, height: 16,
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
    },
    camIconInner: {
        width: 20, height: 14,
        borderWidth: 1.5, borderRadius: 3,
        position: 'absolute',
    },
    camIconLens: {
        width: 6, height: 6, borderRadius: 3,
    },
    camHint: { fontSize: 9, fontWeight: '500', letterSpacing: 0.3 },

    // Mic / voice FAB
    fab: { alignItems: 'center', gap: 8 },
    micBtn: {
        width: 60, height: 60, borderRadius: 30,
        alignItems: 'center', justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 10,
    },
    ripple: {
        position: 'absolute',
        width: 60, height: 60, borderRadius: 30,
        borderWidth: 1.5,
    },
    hint: { fontSize: 10, fontWeight: '500', letterSpacing: 0.3 },
    innerDot: { width: 14, height: 14, borderRadius: 7, opacity: 0.9 },
    typeInstead: { marginTop: -4, paddingVertical: 4 },
    typeInsteadText: { fontSize: 10, fontWeight: '400', letterSpacing: 0.2, textDecorationLine: 'underline' },
    keyLine: { height: 2, borderRadius: 1 },

    typeInsteadText: { fontSize: 10, fontWeight: '400', letterSpacing: 0.2, textDecorationLine: 'underline' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    menuCard: {
        borderRadius: 20,
        paddingTop: 24,
        paddingBottom: 8,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 20,
    },
    menuTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
    menuSubtitle: { fontSize: 13, marginBottom: 20 },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    menuOptionIcon: {
        width: 44, height: 44,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    menuOptionLabel: { fontSize: 15, fontWeight: '500' },
    menuOptionSub: { fontSize: 12, marginTop: 2 },

    // mini camera icon inside modal
    miniCamBody: {
        width: 20, height: 14,
        borderWidth: 1.5, borderRadius: 3,
        position: 'absolute',
    },
    miniCamLens: {
        width: 6, height: 6, borderRadius: 3,
    },

    // mini gallery icon
    miniGallery: {
        width: 20, height: 18,
        borderWidth: 1.5, borderRadius: 3,
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 3,
    },
    miniGalleryInner: {
        width: 10, height: 6, borderRadius: 2, opacity: 0.5,
    },

    cancelBtn: { paddingVertical: 16, alignItems: 'center' },
    cancelText: { fontSize: 14, fontWeight: '500' },

    // Transaction edit modal
    editCard: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        gap: 16,
    },
    editTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
    editLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 8 },
    editInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    categoryPicker: { maxHeight: 60 },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        marginRight: 8,
    },
    categoryChipText: { fontSize: 14, fontWeight: '500' },
    editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    editBtn: {
        flex: 1, height: 48, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    deleteBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    saveBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnText: { fontSize: 15, fontWeight: '600' },
});
