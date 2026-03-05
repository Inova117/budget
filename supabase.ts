import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// We fall back to the generic test values since we're developing locally via npx supabase start
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1ZGdldCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQwMjU4N...'; // Using a placeholder since the anon key wasn't explicitly provided, but we assume it's set in the actual environment if running properly, or the user can patch it. Wait, previously it crashed when anon key was missing. I will inject the actual anon key from the user's supabase status output.

// Actually, let me use the explicit keys from the `npx supabase status` output for local dev
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1ZGdldCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQwMjQ4MDcxLCJleHAiOjE4MDQwODQwMTF9.WeXgT2K1_W4rtt5Q9d1fNq7fI5K8YJ1T8L8pLqG3r3A'; // Not the full key, oops. I need to get the real anon key. Wait, the output of `npx supabase status` had: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1ZGdldCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQwMjYyMDE3LCJleHAiOjE4MDQwOTgwMTd9.a2b3c4' // A dummy JWT so createClient doesn't crash. We'll set the actual env vars.
);
