const GEMINI_API_KEY = "AIzaSyBtBpCHF-Bu_ESn6z_LtOm-dPmJL-wB_vE";
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const transcript = "I spent 15 bucks at Starbucks and then $50 on gas at Chevron.";

async function testGemini() {
    const requestBody = {
        contents: [{
            parts: [{
                text: `You are a financial parsing assistant. Your goal is to extract transactions from the following raw speech transcript:

"${transcript}"

Output your response strictly as a JSON array of objects complying with this schema (Do NOT wrap in markdown code blocks, just raw JSON):
[
  { 
    "amount": <number>, 
    "vendor": "<string>", 
    "inferred_category": "<string>", 
    "raw_text_segment": "<the exact substring from the transcript describing this transaction>" 
  }
]

Categorize using standard broad generic expense categories (e.g. "Groceries", "Dining", "Transportation", "Entertainment", "Utilities", "Housing").
Ensure amount is a positive number (no currency symbols).
If no transactions are found, return an empty array [].`
            }]
        }],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
        }
    };

    console.log("Sending request to Gemini...");
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        console.error("Error:", await response.text());
        return;
    }

    const data = await response.json();
    console.log("Response Content:\n", data.candidates?.[0]?.content?.parts?.[0]?.text);
}

testGemini();
