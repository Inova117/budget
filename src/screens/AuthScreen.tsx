import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    useColorScheme, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { supabase } from '../lib/supabase';

interface Props {
    onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: Props) {
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? dark : light;

    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Required', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            if (mode === 'register') {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                Alert.alert(
                    'Account Created',
                    'Check your email to confirm your account, then sign in.',
                    [{ text: 'OK', onPress: () => setMode('login') }]
                );
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onAuthSuccess();
            }
        } catch (err: any) {
            Alert.alert('Auth Error', err.message);
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
                <Text style={[styles.logo, { color: theme.fg }]}>Centurio</Text>
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
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={[styles.field, { borderColor: theme.border }]}>
                    <TextInput
                        style={[styles.input, { color: theme.fg }]}
                        placeholder="Password"
                        placeholderTextColor={theme.muted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />
                </View>

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
                <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
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
});
