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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();

    // Log the raw response for debugging
    console.log("Gemini RAW:", JSON.stringify(data, null, 2));

    // For debugging: return raw response
    // return res.json({ raw: data });

    // Check for API errors
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API failed",
        raw: data
      });
    }

    // Extract text from response using robust parsing
    const answer = extractText(data);

    if (!answer) {
      return res.status(500).json({
        error: "Gemini returned no extractable text",
        raw: data
      });
    }

    res.json({ answer });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
