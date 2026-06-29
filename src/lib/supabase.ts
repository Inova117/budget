import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the Supabase client.
//
// This MUST be the only `createClient` call in the app. Two GoTrue instances
// would hold divergent sessions (and produce sporadic "Not authenticated"
// errors on edge-function calls). Session is persisted to AsyncStorage so it
// survives a cold start — critical for a "<7s to log" product where re-login
// on every launch would be fatal.
//
// Env vars must be set (copy .env.example → .env). For production they come
// from EAS environment variables — never hardcode keys here.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Denario] Missing Supabase config.\n' +
      'Copy .env.example → .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the auth token fresh only while the app is in the foreground, and stop
// the timer in the background (recommended by the supabase-js RN guide).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
