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

    const { imageBase64, categoryNames } = await req.json()

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'Missing imageBase64' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build dynamic category list
    const cats: string[] = (Array.isArray(categoryNames) && categoryNames.length > 0)
      ? categoryNames
      : ['Groceries', 'Dining', 'Transportation', 'Entertainment', 'Shopping', 'Utilities', 'Healthcare', 'Other']

    // Call Gemini API
    const body = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          },
          {
            text: `Analyze this receipt image and extract ALL items with their prices.\n\nReturn ONLY a valid raw JSON array (no markdown, no code fences):\n[{"amount": <number>, "vendor": "<store name>", "inferred_category": "<category>"}]\n\nKnown categories: ${cats.join(', ')}.\nPick the best matching category. If none fit well, invent a short, descriptive category name in English (e.g. "Veterinary", "Gym", "Taxi").\nIf nothing found, return [].`
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
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const expenses = JSON.parse(cleaned)

    return new Response(JSON.stringify({ expenses }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error processing image:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
