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

// ── Audio upload (server-side, with the secret key) ──────────────────────────
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Uploads the audio and waits until the Gemini Files API marks it ACTIVE.
// Files go through a PROCESSING state first; calling generateContent before the
// file is ACTIVE returns 400 FAILED_PRECONDITION, so we must poll.
async function uploadAudio(bytes: Uint8Array, mimeType: string): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw json({ error: 'GEMINI_API_KEY not set' }, 500);

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ file: { mimeType } })], { type: 'application/json' }));
  form.append('file', new Blob([bytes], { type: mimeType }), 'expense');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${key}`,
    { method: 'POST', body: form },
  );
  const text = await res.text();
  if (!res.ok) throw json({ error: `Audio upload failed: ${text}` }, 502);
  const file = JSON.parse(text)?.file;
  if (!file?.uri || !file?.name) throw json({ error: 'No file URI from upload' }, 502);

  let state: string = file.state ?? 'PROCESSING';
  for (let i = 0; i < 20 && state === 'PROCESSING'; i++) {
    await sleep(500);
    const poll = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${key}`);
    if (!poll.ok) break;
    state = (await poll.json())?.state ?? state;
  }
  if (state === 'FAILED') throw json({ error: 'Audio processing failed' }, 502);
  if (state !== 'ACTIVE') throw json({ error: 'Audio still processing — please try again' }, 504);
  return file.uri;
}

// ── Handler ──────────────────────────────────────────────────────────────────
// Transcribes a voice memo and extracts expenses. The audio bytes arrive as
// base64; the Google Files upload happens here (server-side) with the secret key.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await requireUser(req);

    const { audioBase64, mimeType, categoryNames } = await req.json();
    if (!audioBase64) return json({ error: 'Missing audioBase64' }, 400);
    const cats = categoriesFor(categoryNames);

    const fileUri = await uploadAudio(base64ToBytes(audioBase64), mimeType || 'audio/mp4');

    const prompt = `You are a bilingual (Spanish/English/Spanglish) expense parser. The speaker may mix languages.

Currency/colloquialisms: "bucks/dólares/pesos/lempiras/soles/pilas" → numeric amount; spoken numbers ("veinte"=20, "treinta"=30, "cien"=100).

Listen carefully and extract ALL monetary expenses mentioned.

Return ONLY raw JSON (no markdown):
{"transcript":"<verbatim transcription of what was said>","expenses":[{"amount":<positive number>,"vendor":"<store or description>","inferred_category":"<category>","confidence":<0..1>}]}

confidence = how sure you are about amount AND category (1 = certain).
Known categories: ${cats.join(', ')}.
Pick the best match; if none fit, invent a short English category name.
If no expense is found, return {"transcript":"<what was said>","expenses":[]}.`;

    const raw = await geminiGenerate([
      { fileData: { mimeType: mimeType || 'audio/mp4', fileUri } },
      { text: prompt },
    ]);
    const parsed = parseLoose(raw) ?? {};
    const expenses = normalizeExpenses(Array.isArray(parsed) ? parsed : parsed.expenses);
    const transcript = (!Array.isArray(parsed) && parsed.transcript) ? String(parsed.transcript) : '';

    return json({ transcript, expenses });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('process-audio error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
