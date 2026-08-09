const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const API_KEY = process.env.GEMINI_API_KEY;

/**
 * Calls the Gemini API's generateContent endpoint.
 * @param {string} systemPrompt - persona / behavior instructions
 * @param {{role:'user'|'assistant', text:string}[]} history - prior turns, oldest first
 * @param {string} userText - the newest user message
 * @returns {Promise<string>} the model's reply text
 */
async function askGemini(systemPrompt, history, userText) {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set. Add it to backend/.env");
  }

  // Gemini uses "model" instead of "assistant" for the AI turn.
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  contents.push({ role: "user", parts: [{ text: userText }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text.trim()) {
    throw new Error("Gemini returned an empty response");
  }
  return text.trim();
}

module.exports = { askGemini };
