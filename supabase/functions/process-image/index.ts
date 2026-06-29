import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Shared helpers (inlined so this function deploys standalone — including by
//    pasting into the Supabase dashboard — with no cross-file imports) ────────
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
const DEFAULT_CATEGORIES = [
  'Groceries', 'Dining', 'Transportation', 'Housing', 'Utilities',
  'Entertainment', 'Healthcare', 'Personal Care', 'Shopping',
  'Subscriptions', 'Travel', 'Miscellaneous',
];
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
async function requireUser(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw json({ error: 'Server misconfigured' }, 500);
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw json({ error: 'Unauthorized' }, 401);
  return data.user.id;
}
function categoriesFor(categoryNames: unknown): string[] {
  return Array.isArray(categoryNames) && categoryNames.length > 0
    ? (categoryNames as string[]) : DEFAULT_CATEGORIES;
}
async function geminiGenerate(parts: unknown[]): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw json({ error: 'GEMINI_API_KEY not set' }, 500);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw json({ error: `Gemini API error: ${res.status} ${detail}` }, 502);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
function parseLoose(raw: string): any {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
    return null;
  }
}
function normalizeExpenses(arr: unknown): Array<{ amount: number; vendor: string; inferred_category: string; confidence: number }> {
  if (!Array.isArray(arr)) return [];
  return arr.map((e: any) => {
    const amount = Number(e?.amount);
    const confidence = Number(e?.confidence);
    return {
      amount,
      vendor: String(e?.vendor ?? e?.vendor_name ?? 'Unknown').slice(0, 120),
      inferred_category: String(e?.inferred_category ?? 'Other').slice(0, 60),
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.9,
    };
  }).filter((e) => Number.isFinite(e.amount) && e.amount > 0);
}

// ── Handler ──────────────────────────────────────────────────────────────────
// Scans a receipt. Default: ONE aggregated transaction (vendor + total) so a
// grocery run doesn't explode into N rows. Pass { itemize: true } for line items.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await requireUser(req);

    const { imageBase64, categoryNames, itemize } = await req.json();
    if (!imageBase64) return json({ error: 'Missing imageBase64' }, 400);
    const cats = categoriesFor(categoryNames);

    const prompt = itemize
      ? `Analyze this receipt and extract EACH line item with its price.
Return ONLY raw JSON (no markdown):
{"expenses":[{"amount":<number>,"vendor":"<store name>","inferred_category":"<category>","confidence":<0..1>}]}
Known categories: ${cats.join(', ')}. Pick the best match; if none fit, invent a short English category name.
If nothing is readable, return {"expenses":[]}.`
      : `Analyze this receipt and return ONE expense representing the WHOLE receipt:
the store/vendor name and the GRAND TOTAL actually paid (use the total/"total a pagar", not the subtotal, and not individual items).
Return ONLY raw JSON (no markdown):
{"expenses":[{"amount":<grand total>,"vendor":"<store name>","inferred_category":"<category>","confidence":<0..1>}]}
confidence = how sure you are of the total and vendor (1 = certain).
Known categories: ${cats.join(', ')}. Pick the best match; if none fit, invent a short English category name.
If nothing is readable, return {"expenses":[]}.`;

    const raw = await geminiGenerate([
      { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
      { text: prompt },
    ]);
    const parsed = parseLoose(raw);
    const expenses = normalizeExpenses(Array.isArray(parsed) ? parsed : parsed?.expenses);

    return json({ expenses });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('process-image error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
