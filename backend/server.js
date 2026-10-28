import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

function extractText(data) {
  // normal expected output
  let text = data?.candidates?.[0]?.content?.parts
    ?.map(p => p?.text)
    ?.filter(Boolean)
    ?.join("\n");

  if (text) return text;

  // sometimes content is directly as "text"
  text = data?.candidates?.[0]?.content?.text;
  if (text) return text;

  return null;
}

// Models to try in order — if the primary is overloaded, fall back
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

async function callGemini(apiKey, prompt) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt.trim() }],
      },
    ],
  };

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    // Up to 2 retries per model on 503
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

      if (response.ok) {
        console.log(`✅ Success with model: ${model}`);
        return { response, data };
      }

      // On 503, retry once then try next model
      if (response.status === 503 && attempt < 2) {
        const delay = attempt * 3000;
        console.log(`⏳ ${model} returned 503. Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // On 503 after retries exhausted, try next model
      if (response.status === 503) {
        console.log(`⚠️ ${model} still 503 after ${attempt} attempts. Trying next model...`);
        break;
      }

      // On 404 (model unavailable), try next model
      if (response.status === 404) {
        console.log(`⚠️ ${model} not available (404). Trying next model...`);
        break;
      }

      // Any other error (400, 401, 403, 429, etc.) — don't retry, return immediately
      return { response, data };
    }
  }

  // All models failed
  return {
    response: { ok: false, status: 503 },
    data: {
      error: {
        code: 503,
        message: "All available models are currently overloaded. Please try again later.",
        status: "UNAVAILABLE",
      },
    },
  };
}

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/solve", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY missing in .env" });

    const result = await callGemini(apiKey, prompt);
    const { response, data } = result;

    console.log("Gemini RAW:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      if (response.status === 503) {
        return res.status(503).json({
          error: "AI service is temporarily busy. Please try again in a moment.",
        });
      }
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API failed",
      });
    }

    // Extract text from response using robust parsing
    const answer = extractText(data);

    if (!answer) {
      return res.status(500).json({
        error: "Gemini returned no extractable text",
        raw: data,
      });
    }

    res.json({ answer });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
