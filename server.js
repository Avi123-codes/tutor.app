// server.js (ESM)
import express from "express";
import morgan from "morgan";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8788;

// Logging & JSON
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

// CORS (relaxed for local dev)
app.use(cors());

// Health endpoints
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(process.env.GOOGLE_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    envFrom: process.cwd(),
    cwd: process.cwd()
  });
});
app.get("/healthz", (req, res) => res.json({ ok: true }));

// --- Gemini client ---
const apiKey = process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const textModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-1.5-flash"
});

// ---- /api/chat (text) ----
app.post("/api/chat", async (req, res) => {
  try {
    if (!apiKey) return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });

    const { messages = [] } = req.body || {};
    const coachPreamble =
      "You are a friendly study coach for primary/middle school. Be concise, actionable, and encouraging.";

    const convo = (Array.isArray(messages) ? messages : [])
      .map(m => `${m.role === "user" ? "Student" : "Coach"}: ${m.content}`)
      .join("\n");

    const prompt = `${coachPreamble}\n\nConversation so far:\n${convo}\n\nCoach:`;

    const result = await textModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const text =
      result.response?.text?.() ||
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I’m not sure how to answer that yet.";

    res.json({ text });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    res.status(500).json({ error: "chat_failed" });
  }
});

// ---- /api/chat-image (image + prompt) ----
const upload = multer({ storage: multer.memoryStorage() });
app.post("/api/chat-image", upload.single("image"), async (req, res) => {
  try {
    if (!apiKey) return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const prompt =
      (req.body?.prompt || "Explain this image for a student learning context.").toString();
    const mime = req.file.mimetype || "image/png";
    const b64 = req.file.buffer.toString("base64");

    const result = await textModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: b64 } }]
        }
      ]
    });

    const text =
      result.response?.text?.() ||
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn’t read that image.";

    res.json({ text });
  } catch (err) {
    console.error("[/api/chat-image] error:", err);
    res.status(500).json({ error: "chat_image_failed" });
  }
});

// ---- Serve built frontend (when you run `npm run build`) ----
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));

// SPA fallback (skip API & health routes)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) return next();
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});



