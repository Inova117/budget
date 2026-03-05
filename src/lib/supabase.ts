import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// These MUST be set in your .env file (never hardcoded).
// For development: copy .env.example → .env and fill in the values.
// For production: set these via EAS Secrets or your CI/CD provider.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[CenturioBudget] Missing Supabase config.\n' +
    'Copy .env.example → .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
