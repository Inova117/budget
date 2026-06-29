import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
    useColorScheme, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey, startOfWeek } from '../utils/dates';

const CHECKIN_STORAGE_KEY = 'weekly_checkin_data';
const { height } = Dimensions.get('window');

export type CheckinData = {
    lastCheckinDate: string;        // ISO date 'YYYY-MM-DD'
    weeklyBonus: number;            // -15 to +15
    history: CheckinEntry[];
};

export type CheckinEntry = {
    date: string;
    answers: boolean[];
    bonus: number;
};

const QUESTIONS = [
    'Did you keep your spending within budget this week?',
    'Were you able to set aside any savings?',
    'Did you make any unplanned impulse purchases?',
];

// Points per question: [yesPoints, noPoints]
const POINTS: [number, number][] = [
    [+10, -5],   // Q1: within budget?
    [+8, 0],   // Q2: savings?
    [-7, +5],   // Q3: impulse purchase? (inverted: yes=bad)
];

/** Returns YYYY-MM-DD string for today (local calendar). */
export function todayStr(): string {
    return localDayKey(new Date());
}

/** Returns YYYY-MM-DD for the Monday of the current week (local calendar). */
export function thisWeekMonday(): string {
    return localDayKey(startOfWeek(new Date()));
}

/** Reads stored checkin data from AsyncStorage */
export async function loadCheckinData(): Promise<CheckinData | null> {
    const raw = await AsyncStorage.getItem(CHECKIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
}

/** Saves checkin data to AsyncStorage */
export async function saveCheckinData(data: CheckinData): Promise<void> {
    await AsyncStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(data));
}

/** Returns true if a new check-in is due this week */
export function isCheckinDue(data: CheckinData | null): boolean {
    if (!data) return true;
    const monday = thisWeekMonday();
    // Due if last check-in was before this week's Monday
    return data.lastCheckinDate < monday;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
    visible: boolean;
    onComplete: (bonus: number) => void;
    onDismiss: () => void;
};

export default function WeeklyCheckin({ visible, onComplete, onDismiss }: Props) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? dark : light;

    const [step, setStep] = useState(0);         // which question (0,1,2) or 3 = summary
    const [answers, setAnswers] = useState<boolean[]>([]);
    const [bonus, setBonus] = useState(0);

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const questionFade = useRef(new Animated.Value(1)).current;

    // Slide in when visible
    useEffect(() => {
        if (visible) {
            setStep(0);
            setAnswers([]);
            setBonus(0);
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
                Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            slideAnim.setValue(height);
            fadeAnim.setValue(0);
        }
    }, [visible]);

    const animateQuestionTransition = (cb: () => void) => {
        Animated.timing(questionFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
            cb();
            Animated.timing(questionFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        });
    };

    const handleAnswer = (answer: boolean) => {
        const pts = POINTS[step][answer ? 0 : 1];
        const newBonus = bonus + pts;
        const newAnswers = [...answers, answer];

        animateQuestionTransition(() => {
            setAnswers(newAnswers);
            setBonus(newBonus);
            setStep(step + 1);
        });

        if (step === QUESTIONS.length - 1) {
            // All answered — clamp and finish
            const finalBonus = Math.max(-15, Math.min(15, newBonus));
            const entry: CheckinEntry = {
                date: todayStr(),
                answers: newAnswers,
                bonus: finalBonus,
            };
            // Save async
            loadCheckinData().then(existing => {
                const history = existing?.history ?? [];
                const newData: CheckinData = {
                    lastCheckinDate: todayStr(),
                    weeklyBonus: finalBonus,
                    history: [entry, ...history].slice(0, 12), // keep last 12 weeks
                };
                const finish = () => {
                    // Slide out then notify parent — even if the save failed, so the
                    // check-in isn't re-prompted forever and the bonus still applies.
                    Animated.parallel([
                        Animated.timing(slideAnim, { toValue: height, duration: 350, useNativeDriver: true }),
                        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
                    ]).start(() => onComplete(finalBonus));
                };
                saveCheckinData(newData).then(finish).catch(finish);
            });
        }
    };

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(onDismiss);
    };

    const currentQuestion = QUESTIONS[step] ?? '';
    const progress = QUESTIONS.length;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
            {/* Dark overlay */}
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                {/* Tap overlay to dismiss */}
                <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={handleDismiss} />

                {/* Card */}
                <Animated.View
                    style={[
                        styles.card,
                        { backgroundColor: theme.card },
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.headerLabel, { color: theme.muted }]}>WEEKLY CHECK-IN</Text>
                        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Text style={[styles.closeBtn, { color: theme.muted }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Progress dots */}
                    <View style={styles.dots}>
                        {QUESTIONS.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor:
                                            i < step
                                                ? theme.fg
                                                : i === step
                                                    ? theme.accent
                                                    : theme.border,
                                        width: i === step ? 20 : 8,
                                    },
                                ]}
                            />
                        ))}
                    </View>

                    {/* Question */}
                    {step < progress && (
                        <Animated.View style={{ opacity: questionFade }}>
                            <Text style={[styles.questionNum, { color: theme.muted }]}>
                                {step + 1} of {progress}
                            </Text>
                            <Text style={[styles.question, { color: theme.fg }]}>
                                {currentQuestion}
                            </Text>

                            {/* Buttons */}
                            <View style={styles.btnRow}>
                                <TouchableOpacity
                                    style={[styles.answerBtn, styles.noBtn, { borderColor: theme.border }]}
                                    onPress={() => handleAnswer(false)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.noText, { color: theme.fg }]}>No</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.answerBtn, styles.yesBtn, { backgroundColor: theme.fg }]}
                                    onPress={() => handleAnswer(true)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.yesText, { color: theme.card }]}>Yes</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}

                    <Text style={[styles.footerNote, { color: theme.muted }]}>
                        Your answers adjust your Financial Health Score
                    </Text>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

// ─── Themes & Styles ──────────────────────────────────────────────────────────

const light = { bg: '#f5f5f5', fg: '#111', muted: '#888', card: '#fff', border: '#e5e5e5', accent: '#111' };
const dark = { bg: '#0a0a0a', fg: '#f0f0f0', muted: '#555', card: '#1a1a1a', border: '#2a2a2a', accent: '#f0f0f0' };

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    card: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 28,
        paddingBottom: 48,
        gap: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 30,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 3,
    },
    closeBtn: {
        fontSize: 16,
        fontWeight: '400',
    },
    dots: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    questionNum: {
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    question: {
        fontSize: 22,
        fontWeight: '300',
        lineHeight: 32,
        letterSpacing: -0.3,
        marginBottom: 32,
    },
    btnRow: {
        flexDirection: 'row',
        gap: 12,
    },
    answerBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noBtn: {
        borderWidth: 1.5,
    },
    yesBtn: {},
    noText: {
        fontSize: 17,
        fontWeight: '500',
    },
    yesText: {
        fontSize: 17,
        fontWeight: '600',
    },
    footerNote: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 4,
    },
});
