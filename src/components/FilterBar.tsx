import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';

export type Period = 'today' | 'week' | 'month' | 'all';

const FILTERS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All' },
];

type Props = {
    value: Period;
    onChange: (p: Period) => void;
};

export default function FilterBar({ value, onChange }: Props) {
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? dark : light;

    return (
        <View style={[styles.row, { backgroundColor: theme.bg }]}>
            {FILTERS.map(f => {
                const active = f.key === value;
                return (
                    <TouchableOpacity
                        key={f.key}
                        style={[
                            styles.pill,
                            active
                                ? { backgroundColor: theme.fg }
                                : { borderColor: theme.border, borderWidth: 1 },
                        ]}
                        onPress={() => onChange(f.key)}
                        activeOpacity={0.75}
                    >
                        <Text style={[
                            styles.pillText,
                            { color: active ? theme.bg : theme.muted },
                        ]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const light = { bg: '#f5f5f5', fg: '#111', muted: '#888', border: '#ddd' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', border: '#2a2a2a' };

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 20,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
});
