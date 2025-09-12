// server.js (ESM)
// Robust Gemini backend with detailed logs

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';


const app = express();


const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);         // allow curl/health checks
    if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    cb(new Error("CORS blocked: " + origin));
  }
}));

// --------- Config ---------
const PORT = Number(process.env.PORT || 8788);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Helper to log objects safely
const pretty = (o) => {
  try { return JSON.stringify(o, null, 2); } catch { return String(o); }
};

// --------- Health check ---------
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    cwd: process.cwd(),
    envFrom: process.env._DOTENV_PATH || process.cwd() + '/.env',
    hasKey: Boolean(GEMINI_API_KEY && GEMINI_API_KEY.trim()),
    model: MODEL_NAME,
  });
});

// --------- Init Gemini client (lazy) ---------
function getGemini() {
  if (!GEMINI_API_KEY || !GEMINI_API_KEY.trim()) {
    const msg = 'GEMINI_API_KEY is missing. Put it in .env as GEMINI_API_KEY=...';
    console.error('[server] KEY ERROR:', msg);
    throw new Error(msg);
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

// --------- /api/chat (text only) ---------
app.post('/api/chat', async (req, res) => {
  console.log('\n[server] /api/chat body:', pretty(req.body));

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] is required' });
    }

    // Build a compact transcript and a helpful system preface.
    const system =
      "You are 'Your Tutor'—a friendly, concise study coach for students and parents. " +
      "Answer clearly. If a question is ambiguous, ask a brief clarifying question. " +
      "Use step-by-step logic for math. Keep tone supportive.";

    const transcript = messages
      .slice(-10)
      .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n');

    const prompt = `${system}\n\nConversation:\n${transcript}\n\nAssistant:`;

    const model = getGemini();
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });

    const text = result?.response?.text?.() || '(no response)';
    console.log('[server] Gemini OK, bytes:', text.length);
    return res.json({ text });
  } catch (err) {
    console.error('[server] /api/chat ERROR:', err?.message, '\nSTACK:', err?.stack);
    // Always return JSON so the client can show the reason
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
});

// --------- /api/chat-image (multimodal) ---------
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/chat-image', upload.single('image'), async (req, res) => {
  console.log('\n[server] /api/chat-image fields:', pretty(req.body), 'file:', !!req.file);

  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });

    const prompt = (req.body?.prompt || 'Describe this.').toString();
    const mimeType = req.file.mimetype || 'image/png';
    const base64 = req.file.buffer.toString('base64');

    const model = getGemini();
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: "You are 'Your Tutor'. Be concise and helpful." },
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
    });

    const text = result?.response?.text?.() || '(no response)';
    console.log('[server] Gemini image OK, bytes:', text.length);
    return res.json({ text });
  } catch (err) {
    console.error('[server] /api/chat-image ERROR:', err?.message, '\nSTACK:', err?.stack);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
});

// --------- Start ---------
app.listen(PORT, () => {
  console.log(`\nGemini server running on http://localhost:${PORT}`);
});
