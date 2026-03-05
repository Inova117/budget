import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { fileUri, categoryNames } = await req.json()

    if (!fileUri) {
      return new Response(JSON.stringify({ error: 'Missing fileUri' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build dynamic category list — fall back to defaults if none provided
    const cats: string[] = (Array.isArray(categoryNames) && categoryNames.length > 0)
      ? categoryNames
      : ['Groceries', 'Dining', 'Transportation', 'Entertainment', 'Shopping', 'Utilities', 'Healthcare', 'Other']

    // Call Gemini API
    const body = {
      contents: [{
        parts: [
          { fileData: { mimeType: 'audio/mp4', fileUri } },
          {
            text: `You are a bilingual (Spanish/English) expense parser. The speaker may use Spanish, English, or Spanglish.

Currency terms to recognize:
- "pilas", "pesos", "lempiras", "soles", "bolívares" → treat as USD equivalent
- "bucks", "dólares", "dolar", "USD" → USD
- Numbers may be spoken: "veinte" = 20, "treinta" = 30, "cien" = 100

Listen carefully. Extract ALL monetary expenses mentioned.

Return ONLY a valid raw JSON object (no markdown, no code fences):
{
  "transcript": "<verbatim transcription of what was said>",
  "expenses": [{"amount": <positive number>, "vendor": "<store or description>", "inferred_category": "<category>"}]
}

Known categories: ${cats.join(', ')}.
Pick the best matching category. If none fit, invent a short English category name (e.g. "Veterinary", "Gym", "Pharmacy").
If no expenses found, return { "transcript": "<what was said>", "expenses": [] }.`
          }
        ]
      }],
      generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`)
    }

    const data = await response.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Handle both old array format and new object format
    const expenses = Array.isArray(parsed) ? parsed : (parsed.expenses || [])
    const transcript = typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed.transcript || '') : ''

    return new Response(JSON.stringify({ expenses, transcript }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error processing audio:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
