export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, content, customPrompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API Key is not configured in Vercel environment variables." });
  }

  if (!content) {
    return res.status(400).json({ error: "Content is required." });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${getPromptForAction(action, customPrompt)}\n\nContent:\n${content}` }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Gemini API Error" });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
    return res.status(200).json({ result: reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function getPromptForAction(action, customPrompt) {
  switch (action) {
    case "summarize":
      return "Summarize the following text concisely. Highlight the main takeaways as bullet points.";
    case "explain_code":
      return "Explain what the following code snippet does step-by-step. Keep it concise, clear, and formatted for developers.";
    case "fix_syntax":
      return "Analyze the following code, correct any syntax errors or bugs, and return ONLY the corrected code. Do not add conversational intro/outro text, markdown wrapper lines like ```, or extra explanations—just return the clean, functional code.";
    case "ocr_json":
      return "The following text was extracted from an image via OCR. Clean up the spelling, format it as structured JSON, and return ONLY the clean JSON block. Do not add markdown wrappers or conversational text.";
    case "custom":
      return customPrompt || "Analyze the following content and provide a helpful response.";
    default:
      return "Analyze the following content and provide a helpful response.";
  }
}
