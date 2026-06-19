import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders, json, requireUser, categoriesFor, geminiGenerate, parseLoose, normalizeExpenses,
} from '../_shared/parse.ts';

// Transcribes a voice memo and extracts expenses. V2 change: the audio bytes
// arrive as base64 and the Google Files upload happens HERE (server-side) using
// the secret key — the client no longer ships EXPO_PUBLIC_GEMINI_API_KEY.
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

  // Poll until ACTIVE (typically < 2s for short clips). Cap the wait.
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
