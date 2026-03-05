import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, LayoutDashboard, Settings, Tag } from 'lucide-react-native';

import HomeScreen from '../screens/HomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CategoriesScreen from '../screens/CategoriesScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
    const isDark = useColorScheme() === 'dark';
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
                    borderTopColor: isDark ? '#1a1a1a' : '#e5e5e5',
                    borderTopWidth: 1,
                    paddingBottom: Math.max(insets.bottom, 8),
                    paddingTop: 8,
                    height: 60 + Math.max(insets.bottom, 8),
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                    letterSpacing: 0.5,
                    marginTop: 4,
                },
                tabBarActiveTintColor: isDark ? '#ffffff' : '#111111',
                tabBarInactiveTintColor: isDark ? '#444444' : '#aaaaaa',
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size * 0.9} strokeWidth={2.5} />,
                    tabBarLabel: 'Today',
                }}
            />
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size * 0.9} strokeWidth={2.5} />,
                    tabBarLabel: 'Insights',
                }}
            />
            <Tab.Screen
                name="Categories"
                component={CategoriesScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Tag color={color} size={size * 0.9} strokeWidth={2.5} />,
                    tabBarLabel: 'Categories',
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Settings color={color} size={size * 0.9} strokeWidth={2.5} />,
                    tabBarLabel: 'Budget',
                }}
            />
        </Tab.Navigator>
    );
}
