import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

function extractText(data) {
  let text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text)
    ?.filter(Boolean)
    ?.join("\n");
  if (text) return text;

  text = data?.candidates?.[0]?.content?.text;
  if (text) return text;

  return null;
}

async function callGemini(apiKey, prompt) {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt.trim() }] }],
  };

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) return { response, data };

      if (response.status === 503 && attempt < 2) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }

      if (response.status === 503 || response.status === 404) break;

      return { response, data };
    }
  }

  return {
    response: { ok: false, status: 503 },
    data: { error: { message: "AI service is temporarily busy. Please try again in a moment." } },
  };
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/solve", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY missing in .env" });

    const { response, data } = await callGemini(apiKey, prompt);

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API failed",
      });
    }

    const answer = extractText(data);
    if (!answer) {
      return res.status(500).json({ error: "Gemini returned no extractable text" });
    }

    res.json({ answer });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
