Tutor.Web

A lightweight tutoring web app with Student and Parent portals.

Features:

Simple in-browser “accounts” stored in localStorage

AI Chatbot powered by Google Gemini

Student schedule calendar with drag-and-drop file attachments

Tips and Tricks pages for students and parents

Parent score predictor

Clean UI built with React, Vite, and Tailwind CSS

Note: Authentication in this demo is for local or offline use only and is not production secure.

Tech Stack

Frontend: React 18, Vite, React Router, Tailwind CSS, lucide-react
Backend: Node.js (Express), @google/generative-ai, cors, morgan, multer, dotenv
Runtime: Node.js version 18 or higher

Project Structure

tutor.web/
├─ src/
│ ├─ api.js (Frontend helper that streams chat from backend)
│ ├─ App.jsx (Main app: routes, UI, authentication, state)
│ ├─ main.jsx (React entry point)
│ ├─ index.css (Tailwind entry)
│ └─ ...
├─ index.html
├─ server.js (Express server with Gemini integration)
├─ .env.example (Template for environment variables)
├─ package.json
├─ postcss.config.js
├─ tailwind.config.js
└─ vite.config.js

Setup Instructions

Clone and install
git clone https://github.com/Avi123-codes/tutor.web.git

cd tutor.web
npm install

Configure environment variables
Your real .env file should not be committed. Instead, copy the example file and fill in your details:

cp .env.example .env

Then open .env and insert your Gemini API key:

GEMINI_API_KEY=your_api_key_here
PORT=8787

Get your Gemini API key from Google AI Studio → API Keys (https://makersuite.google.com/app/apikey
).
You might also have to update the Gemini model based on the latest version of the Gemini model.
Keep this file private and never push .env to GitHub.

Run the backend
npm run server
or
node server.js

The backend runs on http://localhost:8787
 by default.

Run the frontend
In a separate terminal:
npm run dev
Then visit http://localhost:5173

Optional: run both together
Install concurrently and add a script:

npm i -D concurrently

Add to package.json:

"scripts": {
"dev": "vite",
"build": "vite build",
"preview": "vite preview",
"server": "node server.js",
"dev:all": "concurrently "npm run server" "npm run dev""
}

Run both:
npm run dev:all

Frontend Overview

Main routes in App.jsx:

/ - Welcome page
/login/student - Student sign-in
/login/parent - Parent sign-in
/signup?role=student - Student account creation
/signup?role=parent - Parent account creation
/student/* - Student dashboard (Chat, Tips, Schedule)
/parent/* - Parent dashboard (Chat, Tips, Schedule, Score Predictor)

Features include:

Local state storage using localStorage

AI Chat integration with Gemini API via backend

Calendar with drag-and-drop file uploads

Score predictor for tracking progress

Responsive layout with Tailwind and lucide-react icons

Backend Overview (server.js)

Built with Express

Uses:
cors for cross-origin requests
morgan for logging
multer for file handling
dotenv for environment variables
@google/generative-ai for Gemini chat integration

Exposes an endpoint such as /api/chat/stream used by src/api.js

The Gemini API key is read from .env and should only exist server-side.

Environment and Security Notes

Never commit .env files

.env.example is safe to share

Revoke any exposed API key on Google AI Studio

Use proper authentication and a real database for production

Sanitize and validate uploads before making them persistent

Build and Deploy

Build the frontend:
npm run build
This creates a production build in the dist folder.

Deployment:
Frontend: Vercel, Netlify, or GitHub Pages
Backend: Render, Railway, Fly.io, or any Node host
Set environment variables (GEMINI_API_KEY, PORT) in your hosting environment
Update the API URL in src/api.js to match your deployed backend

Troubleshooting

CORS error:
Ensure cors() is enabled in server.js
401 or key error:
Check .env and restart backend
Blank page:
Run npm install again or check console logs
Chat not responding:
Verify backend URL in src/api.js and ensure the server is running

License (MIT License)


Acknowledgements

Google @google/generative-ai SDK
React
Vite
Tailwind CSS
lucide-react

