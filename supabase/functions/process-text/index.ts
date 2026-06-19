import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders, json, requireUser, categoriesFor, geminiGenerate, parseLoose, normalizeExpenses,
} from '../_shared/parse.ts';

// Parses a typed sentence into one or more expenses (the PRD's headline
// "Spent $15 at Starbucks and $60 on gas" multi-entity example). V1 used a dumb
// regex that grabbed the first number and hardcoded the category to 'Other'.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await requireUser(req);

    const { text, categoryNames } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return json({ error: 'Missing text' }, 400);
    }
    const cats = categoriesFor(categoryNames);

    const prompt = `You are a bilingual (Spanish/English/Spanglish) expense parser.
Extract ALL monetary expenses from the user's text. There may be several in one sentence.

Currency/colloquialisms: "bucks/dólares/pesos/lempiras/soles/pilas" → numeric amount; spoken numbers ("veinte"=20, "treinta"=30, "cien"=100); "$15", "15 dollars", "quince pesos".

Return ONLY raw JSON (no markdown):
{"expenses":[{"amount":<positive number>,"vendor":"<store or description>","inferred_category":"<category>","confidence":<0..1>}]}

confidence = how sure you are about amount AND category (1 = certain).
Known categories: ${cats.join(', ')}.
Pick the best match; if none fit, invent a short English category name.
If no expense is present, return {"expenses":[]}.

User text: """${text.slice(0, 1000)}"""`;

    const raw = await geminiGenerate([{ text: prompt }]);
    const parsed = parseLoose(raw);
    const expenses = normalizeExpenses(Array.isArray(parsed) ? parsed : parsed?.expenses);

    return json({ transcript: text, expenses });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('process-text error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
