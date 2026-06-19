import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useColorScheme } from 'react-native';
import { HealthScore } from '../utils/healthScore';

type Props = {
    healthScore: HealthScore;
};

export default function HealthScoreBadge({ healthScore }: Props) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const fg = isDark ? '#f0f0f0' : '#111';
    const muted = isDark ? '#555' : '#aaa';
    const border = isDark ? '#2a2a2a' : '#e5e5e5';

    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: healthScore.score,
            duration: 800,
            useNativeDriver: false,
        }).start();
    }, [healthScore.score]);

    const [displayScore, setDisplayScore] = React.useState(0);
    useEffect(() => {
        const id = animValue.addListener(({ value }) => {
            setDisplayScore(Math.round(value));
        });
        return () => animValue.removeListener(id);
    }, [animValue]);

    return (
        <View style={styles.wrapper}>
            <View style={[styles.ring, { borderColor: border }]}>
                <Text style={[styles.scoreNum, { color: fg }]}>
                    {displayScore}
                </Text>
            </View>
            <Text style={[styles.gradeLabel, { color: muted }]}>
                {healthScore.grade}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        gap: 6,
    },
    ring: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreNum: {
        fontSize: 20,
        fontWeight: '200',
        letterSpacing: -1,
    },
    gradeLabel: {
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
});
