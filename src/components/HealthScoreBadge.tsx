import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useColorScheme } from 'react-native';
import { HealthScore } from '../utils/healthScore';

type Props = {
    healthScore: HealthScore;
};

export default function HealthScoreBadge({ healthScore }: Props) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const muted = isDark ? '#555' : '#aaa';

    // Animate score number counting up on mount / change
    const animValue = useRef(new Animated.Value(0)).current;
    const scoreRef = useRef(0);

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: healthScore.score,
            duration: 800,
            useNativeDriver: false,
        }).start();
        scoreRef.current = healthScore.score;
    }, [healthScore.score]);

    // Interpolate for the animated number (we display it via a listener trick)
    const [displayScore, setDisplayScore] = React.useState(0);
    useEffect(() => {
        const id = animValue.addListener(({ value }) => {
            setDisplayScore(Math.round(value));
        });
        return () => animValue.removeListener(id);
    }, [animValue]);

    return (
        <View style={styles.wrapper}>
            {/* Outer subtle ring */}
            <View style={[styles.ring, { borderColor: healthScore.color + '33' }]}>
                {/* Inner filled dot */}
                <View style={[styles.inner, { backgroundColor: healthScore.color + '18' }]}>
                    <Text style={[styles.scoreNum, { color: healthScore.color }]}>
                        {displayScore}
                    </Text>
                </View>
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
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inner: {
        width: 52,
        height: 52,
        borderRadius: 26,
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
