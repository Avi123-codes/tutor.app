// Run with: npm run server
// Requires: npm i express cors morgan multer dotenv @google/generative-ai

import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// Configuring environment variables
const PORT = Number(process.env.PORT || 8787);
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// If person has forgotten to enter the key, exit with error
if (!GEMINI_KEY) {
  console.error("❌ GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// App
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// memory storage for image uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// To check health
app.get("/health", async (req, res) => {
  res.json({
    ok: true,
    hasKey: !!GEMINI_KEY,
    model: MODEL,
    port: PORT,
  });
});

// Chat-based chatbot using Gemini api
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Body must include { messages: Array }" });
    }

    
    const preface =
      "You are a friendly study coach for school students. Be concise and helpful. Explain step by step. Have clear formatting.";
    const chatText =
      messages.map(m => `${m.role}: ${m.content}`).join("\n");

    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent([preface, "\n\n", chatText]);
    const text = result?.response?.text?.() ?? "";

    return res.json({ text });
  } catch (err) {
    console.error("Chat error:", err);
    const msg = err?.message || "Server error";
    return res.status(500).json({ error: msg });
  }
});

// Attempt to use image input in chat
app.post("/api/chat-image", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    const prompt = (req.body?.prompt || "").toString();

    if (!file) return res.status(400).json({ error: "image file is required" });
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const mimeType = file.mimetype || "image/png";
    const base64 = file.buffer.toString("base64");

    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent([
      { text: "You are a helpful study coach. Explain clearly and step by step." },
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
    ]);

    const text = result?.response?.text?.() ?? "";
    return res.json({ text });
  } catch (err) {
    console.error("Image chat error:", err);
    const msg = err?.message || "Server error";
    return res.status(500).json({ error: msg });
  }
});

// When server is ran
app.listen(PORT, () => {
  console.log(`✅ Gemini server running on http://localhost:${PORT}`);
});
