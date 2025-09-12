# Tutor App (local)

## Prereqs
- Node 18+ (works on Node 22)
- npm

## Setup
1. Install:
   ```bash
   npm install
Create .env from .env.example and set GOOGLE_API_KEY.

Run dev (starts API :8788 + Vite :5173):

bash
Copy code
npm run dev
Open http://localhost:5173

Troubleshooting
Port in use (EADDRINUSE 8788):

Change PORT in .env, also update VITE_API_BASE or vite.config.js proxy.

“Failed to fetch” from chat:

Check server terminal logs.

Open http://localhost:8788/health to confirm the API is alive.

Build & single-server run
bash
Copy code
npm run build
npm start   # serves /dist + /api on same port
yaml
Copy code

---

# How to run locally (after copying the above files)

bash
npm install
# create .env from .env.example and add your GOOGLE_API_KEY
npm run dev
Frontend → http://localhost:5173

API → http://localhost:8788 (/health, /api/chat, /api/chat-image)

If the frontend can’t reach the API, check:

Console → Network → /api/chat response/error

Server terminal (it logs all errors)
