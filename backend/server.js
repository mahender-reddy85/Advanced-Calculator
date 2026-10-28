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

async function callGemini(url, apiKey, prompt) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt.trim() }],
      },
    ],
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
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
      return { response, data };
    }

    // Retry only on 503 (temporary overload), not 429 (quota/rate-limit)
    if (response.status === 503 && attempt < 3) {
      const delay = attempt * 3000;
      console.log(`Gemini 503. Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    return { response, data };
  }
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

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    const result = await callGemini(url, apiKey, prompt);
    const { response, data } = result;

    console.log("Gemini RAW:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      // Return a user-friendly message for 503 instead of raw error
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
