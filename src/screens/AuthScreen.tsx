import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
    useColorScheme, ActivityIndicator, KeyboardAvoidingView, Platform, Linking
} from 'react-native';
import { supabase } from '../lib/supabase';
import { CURRENCIES } from '../utils/format';
import { LEGAL_URLS } from '../lib/legal';

interface Props {
    onAuthSuccess: () => void;
}

/** Turns raw Supabase auth errors into a clear, human message. */
function friendlyAuthError(err: any): string {
    const m = (err?.message || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
    if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'That email is already registered. Try signing in instead.';
    if (m.includes('should be at least') || m.includes('password')) return err?.message || 'Password is too weak.';
    if (m.includes('unable to validate email') || m.includes('invalid email')) return 'That email address looks invalid.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a moment and try again.';
    if (m.includes('failed to fetch') || m.includes('network')) return 'Network error — check your connection and the Supabase URL in .env.';
    return err?.message || 'Something went wrong. Please try again.';
}

export default function AuthScreen({ onAuthSuccess }: Props) {
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? dark : light;

    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [signupCurrency, setSignupCurrency] = useState('USD');
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    // Inline feedback (Alert.alert is a no-op on web, so errors must render in the UI).
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const handleSubmit = async () => {
        setError(null);
        setInfo(null);
        if (!email.trim() || !password.trim()) {
            setError('Please enter your email and password.');
            return;
        }
        if (mode === 'register' && !agreed) {
            setError('Please accept the Terms, Privacy Policy and Disclaimer to create your account.');
            return;
        }
        setLoading(true);
        try {
            if (mode === 'register') {
                // Currency chosen at signup is stored in user metadata; the app
                // applies it to the user's preferences on first load.
                const { error } = await supabase.auth.signUp({
                    email, password, options: { data: { currency: signupCurrency } },
                });
                if (error) throw error;
                setInfo('Account created — check your email to confirm, then sign in.');
                setMode('login');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onAuthSuccess();
            }
        } catch (err: any) {
            setError(friendlyAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.bg }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.inner}>
                {/* Logo / wordmark */}
                <Text style={[styles.logo, { color: theme.fg }]}>Denario</Text>
                <Text style={[styles.tagline, { color: theme.muted }]}>
                    {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
                </Text>

                {/* Fields */}
                <View style={[styles.field, { borderColor: theme.border }]}>
                    <TextInput
                        style={[styles.input, { color: theme.fg }]}
                        placeholder="Email"
                        placeholderTextColor={theme.muted}
                        value={email}
                        onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onSubmitEditing={handleSubmit}
                    />
                </View>

                <View style={[styles.field, { borderColor: theme.border }]}>
                    <TextInput
                        style={[styles.input, { color: theme.fg }]}
                        placeholder="Password"
                        placeholderTextColor={theme.muted}
                        value={password}
                        onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
                        secureTextEntry
                        autoCapitalize="none"
                        onSubmitEditing={handleSubmit}
                        returnKeyType="go"
                    />
                </View>

                {/* Currency picker (registration only) */}
                {mode === 'register' && (
                    <View>
                        <Text style={[styles.currencyLabel, { color: theme.muted }]}>CURRENCY</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyRow}>
                            {CURRENCIES.map(c => {
                                const active = c.code === signupCurrency;
                                return (
                                    <TouchableOpacity
                                        key={c.code}
                                        onPress={() => setSignupCurrency(c.code)}
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
                )}

                {/* Clickwrap consent (registration only) — makes the Terms, Privacy
                    Policy and Disclaimer an affirmatively-accepted agreement. */}
                {mode === 'register' && (
                    <View style={styles.agreeRow}>
                        <TouchableOpacity
                            onPress={() => { setAgreed(a => !a); if (error) setError(null); }}
                            activeOpacity={0.7}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: agreed }}
                            accessibilityLabel="I agree to the Terms, Privacy Policy and Disclaimer"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={[
                                styles.checkbox,
                                { borderColor: agreed ? theme.fg : theme.border, backgroundColor: agreed ? theme.fg : 'transparent' },
                            ]}
                        >
                            {agreed && <Text style={[styles.checkboxTick, { color: theme.bg }]}>✓</Text>}
                        </TouchableOpacity>
                        <Text style={[styles.agreeText, { color: theme.muted }]}>
                            I agree to the{' '}
                            <Text style={[styles.link, { color: theme.fg }]} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>Terms</Text>,{' '}
                            <Text style={[styles.link, { color: theme.fg }]} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>Privacy Policy</Text>{' '}and{' '}
                            <Text style={[styles.link, { color: theme.fg }]} onPress={() => Linking.openURL(LEGAL_URLS.disclaimer)}>Financial &amp; AI Disclaimer</Text>.
                        </Text>
                    </View>
                )}

                {/* Inline feedback — visible on web AND native */}
                {error && (
                    <View style={styles.banner} accessibilityLiveRegion="polite">
                        <Text style={styles.bannerError}>{error}</Text>
                    </View>
                )}
                {info && (
                    <View style={[styles.banner, styles.bannerInfoWrap]} accessibilityLiveRegion="polite">
                        <Text style={styles.bannerInfo}>{info}</Text>
                    </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.btn, { backgroundColor: theme.fg }]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <ActivityIndicator color={theme.bg} />
                        : <Text style={[styles.btnText, { color: theme.bg }]}>
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </Text>
                    }
                </TouchableOpacity>

                {/* Toggle */}
                <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setInfo(null); }}>
                    <Text style={[styles.toggle, { color: theme.muted }]}>
                        {mode === 'login'
                            ? "Don't have an account? Create one"
                            : 'Already have an account? Sign in'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const light = { bg: '#fafafa', fg: '#111', muted: '#999', border: '#ddd' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', border: '#222' };

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: {
        flex: 1, justifyContent: 'center',
        paddingHorizontal: 32, gap: 16,
    },
    logo: {
        fontSize: 40, fontWeight: '200',
        letterSpacing: -1.5, marginBottom: 4,
    },
    tagline: { fontSize: 16, fontWeight: '300', marginBottom: 24 },
    field: {
        borderWidth: 1, borderRadius: 14,
        paddingHorizontal: 16, height: 52,
        justifyContent: 'center',
    },
    input: { fontSize: 16, fontWeight: '300' },
    btn: {
        height: 52, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 8,
    },
    btnText: { fontSize: 16, fontWeight: '600' },
    toggle: { textAlign: 'center', fontSize: 13, marginTop: 8 },
    banner: {
        backgroundColor: 'rgba(255,59,48,0.10)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginTop: -4,
    },
    bannerInfoWrap: { backgroundColor: 'rgba(48,161,78,0.10)' },
    bannerError: { color: '#ff3b30', fontSize: 14, fontWeight: '500', textAlign: 'center' },
    bannerInfo: { color: '#30a14e', fontSize: 14, fontWeight: '500', textAlign: 'center' },
    agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4, paddingRight: 4 },
    checkbox: {
        width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    checkboxTick: { fontSize: 13, fontWeight: '700', lineHeight: 15 },
    agreeText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '300' },
    link: { fontWeight: '500', textDecorationLine: 'underline' },
    currencyLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 8, marginLeft: 2 },
    currencyRow: { gap: 8, paddingVertical: 2 },
    currencyChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
    currencyCode: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
});
