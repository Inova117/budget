import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsHeaders, json, requireUser, categoriesFor, geminiGenerate, parseLoose, normalizeExpenses,
} from '../_shared/parse.ts';

// Scans a receipt. V2 default: ONE aggregated transaction (vendor + total) so a
// grocery run doesn't explode into N rows. Pass { itemize: true } to extract
// individual line items instead. Result is reviewed in the confirm modal.
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
