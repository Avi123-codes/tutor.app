// server.js  (ESM)
// Run locally with:  npm run server
// Deploy: build frontend (vite build) then `node server.js` serves /dist + APIs.

import express from "express";
import morgan from "morgan";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});


// ------------ Config ------------ //
const PORT = process.env.PORT || 8787;

if (!process.env.GOOGLE_API_KEY) {
  console.warn(
    "[warn] GOOGLE_API_KEY is not set. /api/chat will return 500 until you add it."
  );
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Multer for image uploads (to memory)
const upload = multer({ storage: multer.memoryStorage() });

// ------------ App ------------ //
const app = express();
app.use(morgan("dev"));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health check (useful on Render)
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---- Text Chat: POST /api/chat ----
// Expects: { messages: [{role:"user"|"assistant", content:string}, ...] }
app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });
    }

    const { messages = [] } = req.body || {};
    const history = Array.isArray(messages) ? messages : [];

    // Flatten your chat history into a single prompt for Gemini.
    // (Gemini supports multi-turn, but for reliability we concatenate here.)
    const coachPreamble =
      "You are a friendly study coach for primary/middle school. " +
      "Answer clearly and concisely. If asked math, show steps.";

    const convo = history
      .map((m) => `${m.role === "user" ? "Student" : "Coach"}: ${m.content}`)
      .join("\n");

    const prompt = `${coachPreamble}\n\nConversation so far:\n${convo}\n\nCoach:`;

    const result = await textModel.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const out = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.json({ text: out || "I’m not sure how to answer that yet." });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    return res.status(500).json({ error: "chat_failed" });
  }
});

// ---- Image + Prompt: POST /api/chat-image ----
// multipart/form-data with fields:
// - image: file
// - prompt: string
app.post("/api/chat-image", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });
    }
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const prompt = (req.body?.prompt || "Describe this image for a student.").toString();

    // Convert the uploaded image to base64 for inlineData
    const mime = req.file.mimetype || "image/png";
    const b64 = req.file.buffer.toString("base64");

    const result = await textModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mime, data: b64 } },
          ],
        },
      ],
    });

    const out = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.json({ text: out || "I couldn’t read that image." });
  } catch (err) {
    console.error("[/api/chat-image] error:", err);
    return res.status(500).json({ error: "chat_image_failed" });
  }
});

// ------------ Static Frontend (Vite build) ------------ //
// Make sure you ran `npm run build` (which creates /dist).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));

// Send index.html for any non-API route (client-side routing)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distDir, "index.html"));
});

// ------------ Start ------------ //
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

