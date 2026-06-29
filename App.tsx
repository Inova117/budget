import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { AppProvider } from './src/context/AppContext';
import { FeedbackProvider } from './src/components/FeedbackProvider';
import TabNavigator from './src/navigation/TabNavigator';
import AuthScreen from './src/screens/AuthScreen';
import { supabase } from './src/lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an existing session on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <FeedbackProvider>
          <AuthScreen onAuthSuccess={() => {/* session state updates via onAuthStateChange */ }} />
        </FeedbackProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <FeedbackProvider>
        <AppProvider>
          <NavigationContainer>
            <TabNavigator />
          </NavigationContainer>
        </AppProvider>
      </FeedbackProvider>
    </SafeAreaProvider>
  );
}
