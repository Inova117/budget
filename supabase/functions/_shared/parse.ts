// Shared helpers for the Centurio AI edge functions (process-text / -audio / -image).
// Deno runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Stable Gemini Flash model (the old gemini-2.0-flash-exp was an experimental id).
export const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';

export const DEFAULT_CATEGORIES = [
  'Groceries', 'Dining', 'Transportation', 'Housing', 'Utilities',
  'Entertainment', 'Healthcare', 'Personal Care', 'Shopping',
  'Subscriptions', 'Travel', 'Miscellaneous',
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/**
 * Verifies the caller's Supabase JWT. Returns the user id, or throws a Response
 * (401) that the handler should return directly. V1 only checked that an
 * Authorization header existed — anyone could spend the Gemini quota.
 */
export async function requireUser(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw json({ error: 'Server misconfigured' }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw json({ error: 'Unauthorized' }, 401);
  return data.user.id;
}

export function categoriesFor(categoryNames: unknown): string[] {
  return Array.isArray(categoryNames) && categoryNames.length > 0
    ? (categoryNames as string[])
    : DEFAULT_CATEGORIES;
}

/** Calls Gemini generateContent with the given content parts and returns raw text. */
export async function geminiGenerate(parts: unknown[]): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw json({ error: 'GEMINI_API_KEY not set' }, 500);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw json({ error: `Gemini API error: ${res.status} ${detail}` }, 502);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/** Tolerant JSON parse — strips code fences and returns null on failure. */
export function parseLoose(raw: string): any {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last resort: pull the first {...} or [...] block out of noisy output.
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

export type ParsedExpense = {
  amount: number;
  vendor: string;
  inferred_category: string;
  confidence: number;
};

/** Validates/normalizes AI expense objects, dropping anything without a real amount. */
export function normalizeExpenses(arr: unknown): ParsedExpense[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((e: any) => {
      const amount = Number(e?.amount);
      const confidence = Number(e?.confidence);
      return {
        amount,
        vendor: String(e?.vendor ?? e?.vendor_name ?? 'Unknown').slice(0, 120),
        inferred_category: String(e?.inferred_category ?? 'Other').slice(0, 60),
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.9,
      };
    })
    .filter((e) => Number.isFinite(e.amount) && e.amount > 0);
}
