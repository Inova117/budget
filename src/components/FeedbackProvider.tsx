import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import {
    View, Text, Modal, TouchableOpacity, StyleSheet, Animated, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// Cross-platform feedback. React Native's Alert.alert is a no-op on web, so
// confirmations (delete) and error popups silently vanished in the browser.
// This provides a themed confirm dialog + a toast that work on web AND native.
// ─────────────────────────────────────────────────────────────────────────────

type ConfirmOpts = {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
};
type ToastType = 'error' | 'success' | 'info';

type FeedbackCtx = {
    confirm: (opts: ConfirmOpts) => Promise<boolean>;
    toast: {
        show: (msg: string, type?: ToastType) => void;
        error: (msg: string) => void;
        success: (msg: string) => void;
        info: (msg: string) => void;
    };
};

const Ctx = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? dark : light;
    const insets = useSafeAreaInsets();

    // ── Confirm dialog ─────────────────────────────────────────────────────────
    const [confirmState, setConfirmState] = useState<ConfirmOpts | null>(null);
    const resolver = useRef<((v: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOpts) => {
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
            setConfirmState(opts);
        });
    }, []);

    const closeConfirm = useCallback((value: boolean) => {
        setConfirmState(null);
        resolver.current?.(value);
        resolver.current = null;
    }, []);

    // ── Toast ──────────────────────────────────────────────────────────────────
    const [toastState, setToastState] = useState<{ msg: string; type: ToastType } | null>(null);
    const slide = useRef(new Animated.Value(-120)).current;
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((msg: string, type: ToastType = 'info') => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setToastState({ msg, type });
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
        hideTimer.current = setTimeout(() => {
            Animated.timing(slide, { toValue: -120, duration: 250, useNativeDriver: true })
                .start(() => setToastState(null));
        }, 3400);
    }, [slide]);

    const toast = {
        show: showToast,
        error: (m: string) => showToast(m, 'error'),
        success: (m: string) => showToast(m, 'success'),
        info: (m: string) => showToast(m, 'info'),
    };

    return (
        <Ctx.Provider value={{ confirm, toast }}>
            {children}

            {/* Toast (top, below the status bar) */}
            {toastState && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.toastWrap,
                        { top: insets.top + 8, transform: [{ translateY: slide }] },
                    ]}
                >
                    <View style={[styles.toast, { backgroundColor: toastBg(toastState.type, isDark) }]}>
                        <Text style={[styles.toastText, { color: toastFg(toastState.type) }]}>
                            {toastState.msg}
                        </Text>
                    </View>
                </Animated.View>
            )}

            {/* Confirm dialog */}
            <Modal visible={!!confirmState} transparent animationType="fade" onRequestClose={() => closeConfirm(false)}>
                <View style={styles.overlay}>
                    <View style={[styles.dialog, { backgroundColor: theme.card }]}>
                        <Text style={[styles.dialogTitle, { color: theme.fg }]}>{confirmState?.title}</Text>
                        {confirmState?.message ? (
                            <Text style={[styles.dialogMsg, { color: theme.muted }]}>{confirmState.message}</Text>
                        ) : null}
                        <View style={styles.dialogActions}>
                            <TouchableOpacity
                                style={[styles.dialogBtn, { borderColor: theme.border, borderWidth: 1 }]}
                                onPress={() => closeConfirm(false)}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.dialogBtnText, { color: theme.fg }]}>
                                    {confirmState?.cancelLabel ?? 'Cancel'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dialogBtn, { backgroundColor: confirmState?.destructive ? '#ff3b30' : theme.fg }]}
                                onPress={() => closeConfirm(true)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.dialogBtnText, { color: confirmState?.destructive ? '#fff' : theme.bg, fontWeight: '600' }]}>
                                    {confirmState?.confirmLabel ?? 'Confirm'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Ctx.Provider>
    );
}

function toastBg(type: ToastType, isDark: boolean): string {
    if (type === 'error') return '#ff3b30';
    if (type === 'success') return '#30a14e';
    return isDark ? '#2a2a2a' : '#333';
}
function toastFg(_type: ToastType): string {
    return '#fff';
}

export function useConfirm() {
    const c = useContext(Ctx);
    if (!c) throw new Error('useConfirm must be inside FeedbackProvider');
    return c.confirm;
}
export function useToast() {
    const c = useContext(Ctx);
    if (!c) throw new Error('useToast must be inside FeedbackProvider');
    return c.toast;
}

const light = { bg: '#fafafa', fg: '#111', muted: '#777', card: '#fff', border: '#e5e5e5' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#999', card: '#1c1c1e', border: '#2a2a2a' };

const styles = StyleSheet.create({
    toastWrap: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        alignItems: 'center',
    },
    toast: {
        maxWidth: 460,
        width: '100%',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
    },
    toastText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },

    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    dialog: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 24,
        gap: 12,
    },
    dialogTitle: { fontSize: 18, fontWeight: '600' },
    dialogMsg: { fontSize: 14, lineHeight: 20 },
    dialogActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    dialogBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogBtnText: { fontSize: 15 },
});
