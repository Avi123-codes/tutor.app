
import React, { useMemo, useState, useEffect, useContext, createContext } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  Sparkles,
  Mail,
  Menu,
  Upload,
  MessageCircle,
  Calendar as CalendarIcon,
  Home,
  BrainCircuit,
  Lightbulb,
  Gauge,
  LogOut,
  UserPlus,
  Lock,
} from "lucide-react";
import { streamChat } from "./api";

//helpers for localStorage state management 
const STATE_KEY = "__tutor_app_state_v2__";

function canUseLocalStorage() {
  try {
    if (typeof window === "undefined") return false;
    const k = "__ls_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function toBase64(str) {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  } catch {
    return btoa(str);
  }
}
function fromBase64(b64) {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return atob(b64);
  }
}
export function encodeStateToDataURL(obj) {
  const json = JSON.stringify(obj ?? {});
  return `data:application/json;base64,${toBase64(json)}`;
}
export function decodeStateFromDataURL(raw) {
  try {
    if (!raw || typeof raw !== "string") return {};
    if (raw.startsWith("data:")) {
      const idx = raw.indexOf(",");
      const payload = idx >= 0 ? raw.slice(idx + 1) : "";
      return JSON.parse(fromBase64(payload)) || {};
    }
    if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) return JSON.parse(raw) || {};
    return {};
  } catch {
    return {};
  }
}

const inMemoryState = {};
function readState() {
  try {
    if (!canUseLocalStorage()) return inMemoryState;
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return {};
    return decodeStateFromDataURL(raw);
  } catch {
    return {};
  }
}
function writeState(next) {
  try {
    if (!canUseLocalStorage()) {
      Object.assign(inMemoryState, next);
      return;
    }
    window.localStorage.setItem(STATE_KEY, encodeStateToDataURL(next));
  } catch {}
}

// Data guards
export function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
export function coerceActivities(val) {
  if (!val || typeof val !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (!isISODate(k)) continue;
    if (Array.isArray(v)) out[k] = v.map(String).slice(0, 50);
  }
  return out;
}
export function coerceAttachments(val) {
  if (!val || typeof val !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (!isISODate(k)) continue;
    if (Array.isArray(v)) out[k] = v.map((f) => ({ name: String(f.name || f), size: Number(f.size || 0) })).slice(0, 50);
  }
  return out;
}

function getInitialState() {
  const state = readState();
  const clean = {
    student_activities: coerceActivities(state.student_activities),
    attachments: coerceAttachments(state.attachments),
    exam_date: isISODate(state.exam_date) ? state.exam_date : "",
    target_score: Number.isFinite(Number(state.target_score)) ? Number(state.target_score) : 75,
    users: state.users && typeof state.users === "object" ? state.users : {}, // { email: { email, name, passwordHash } }
    currentUser: state.currentUser && typeof state.currentUser === "object" ? state.currentUser : null,
  };
  return clean;
}
const stateCache = getInitialState();
const storage = {
  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(stateCache, key) && stateCache[key] != null
      ? stateCache[key]
      : fallback;
  },
  set(key, value) {
    if (key === "student_activities") stateCache[key] = coerceActivities(value);
    else if (key === "attachments") stateCache[key] = coerceAttachments(value);
    else if (key === "exam_date") stateCache[key] = isISODate(value) ? value : "";
    else if (key === "target_score") stateCache[key] = Number.isFinite(Number(value)) ? Number(value) : 75;
    else stateCache[key] = value;
    writeState(stateCache);
  },
};

const KEYS = {
  STUDENT_ACTIVITIES: "student_activities",
  ATTACHMENTS: "attachments",
  EXAM_DATE: "exam_date",
  TARGET_SCORE: "target_score",
  USERS: "users",
  CURRENT_USER: "currentUser",
};

//Authentication 
const AuthCtx = createContext(null);
function hash(pw) {
  try {
    let h = 0;
    for (let i = 0; i < String(pw).length; i++) h = (h * 31 + String(pw).charCodeAt(i)) | 0;
    return String(h);
  } catch {
    return "0";
  }
}
function AuthProvider({ children }) {
  const [user, setUser] = useState(() => storage.get(KEYS.CURRENT_USER, null));
  const users = storage.get(KEYS.USERS, {});

  const signIn = (email, password) => {
    const u = users[email.toLowerCase()];
    if (u && u.passwordHash === hash(password)) {
      setUser({ email: u.email, name: u.name });
      storage.set(KEYS.CURRENT_USER, { email: u.email, name: u.name });
      return { ok: true };
    }
    return { ok: false, error: "Invalid credentials" };
  };
  const signUp = (name, email, password) => {
    const key = email.toLowerCase();
    if (users[key]) return { ok: false, error: "Email already registered" };
    const next = { ...users, [key]: { name, email: key, passwordHash: hash(password) } };
    storage.set(KEYS.USERS, next);
    setUser({ email: key, name });
    storage.set(KEYS.CURRENT_USER, { email: key, name });
    return { ok: true };
  };
  const signOut = () => {
    setUser(null);
    storage.set(KEYS.CURRENT_USER, null);
  };

  return (
    <AuthCtx.Provider value={{ user, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
function useAuth() { return useContext(AuthCtx); }

function PrivateRoute({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login/student?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}

//Website's shell
function Shell({ children }) {
  const { user, signOut } = useAuth();
  return (
    <div>
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-gray-900">
        <header className="sticky top-0 z-20 border-b border-white/40 bg-white/70 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
            <Link to="/" className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-600" />
              <span className="font-semibold tracking-tight md:text-lg">Your Tutor</span>
            </Link>
            <div className="hidden items-center gap-6 text-sm md:flex">
              <Link to="/" className="opacity-80 hover:opacity-100">Home</Link>
              <Link to="/login/student" className="opacity-80 hover:opacity-100">Students</Link>
              <Link to="/login/parent" className="opacity-80 hover:opacity-100">Parents</Link>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <div className="hidden sm:flex items-center gap-3 text-sm opacity-80">
                  <span>Hello, {user.name || user.email}</span>
                  <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 shadow-sm hover:bg-gray-50">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </nav>
        </header>

        <main>{children}</main>

        <footer className="border-t border-gray-200 py-8 text-sm opacity-80">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
            <div>© {new Date().getFullYear()} Your Tutor. All rights reserved.</div>
            <a href="#" className="hover:opacity-100 opacity-80">Privacy</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

//Welcom Page
function Welcome() {
  const nav = useNavigate();
  return (
    <section className="mx-auto max-w-xl px-4 py-16 md:py-24">
      <h1 className="text-center text-4xl font-semibold">Welcome!</h1>
      <p className="mt-2 text-center text-gray-600">Choose a portal</p>
      <div className="mt-8 grid gap-4">
        <button onClick={() => nav("/login/student")} className="w-full rounded-2xl border border-gray-300 bg-white px-6 py-4 text-left text-lg font-medium shadow-sm hover:shadow-md">Students Login</button>
        <button onClick={() => nav("/login/parent")} className="w-full rounded-2xl border border-gray-300 bg-white px-6 py-4 text-left text-lg font-medium shadow-sm hover:shadow-md">Parents Login</button>
      </div>
    </section>
  );
}

//Screen where the person logs in and signs up
function Login({ role }) {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    const r = signIn(email, password);
    if (!r.ok) return setErr(r.error || "Login failed");
    const next = new URLSearchParams(window.location.hash.split("?")[1]).get("next") || (role === "student" ? "/student" : "/parent");
    nav(next);
  }

  return (
  <section className="relative isolate">
    <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-indigo-100/60 to-transparent" />
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2 md:items-center">
      <div className="hidden md:block">
        <h2 className="text-4xl font-semibold leading-tight">
          {role === "student" ? "Students" : "Parents"} Portal
        </h2>
        <p className="mt-3 text-gray-600">
          Sign in to access your dashboard, chat, tips and schedule.
        </p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <h3 className="text-xl font-semibold">Sign in</h3>
          </div>

          {err && (
            <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">
              {err}
            </div>
          )}

          <form onSubmit={submit} className="grid gap-3">
            <label className="text-sm">
              <span className="mb-1 block opacity-80">Email</span>
              <input
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block opacity-80">Password</span>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <button className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-indigo-700">
              <Mail className="h-4 w-4" /> Sign in
            </button>
          </form>

          {/* 🔔 Reminder about parent-student sync */}
          <p className="mt-3 text-xs text-gray-500">
            Note: Parents and students should use the <strong>same email</strong> so
            that schedules and progress stay synced.
          </p>

          <div className="mt-4 text-sm">
            New here?{" "}
            <Link
              to={`/signup?role=${role}`}
              className="inline-flex items-center gap-1 underline"
            >
              <UserPlus className="h-4 w-4" />
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);
}

function SignUp() {
  const params = new URLSearchParams(useLocation().search);
  const role = params.get("role") || "student";
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    const r = signUp(name, email, password);
    if (!r.ok) return setErr(r.error || "Sign up failed");
    nav(role === "student" ? "/student" : "/parent");
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          <h3 className="text-xl font-semibold">Create {role} account</h3>
        </div>
        {err && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">{err}</div>}
        <form onSubmit={submit} className="grid gap-3">
          <label className="text-sm">
            <span className="mb-1 block opacity-80">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block opacity-80">Email</span>
            <input required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block opacity-80">Password</span>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <button className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-indigo-700">
            <UserPlus className="h-4 w-4" /> Create account
          </button>
        </form>
      </div>
    </section>
  );
}

//Side navigation menu
function SideNav({ role }) {
  const [open, setOpen] = useState(true);
  const base = role === "student" ? "/student" : "/parent";
  const links = [
    { to: `${base}`, label: "Home", icon: Home },
    { to: `${base}/chat`, label: "AI Chatbot", icon: MessageCircle },
    { to: `${base}/tips`, label: "Tips & Tricks", icon: Lightbulb },
    { to: `${base}/schedule`, label: "Schedule", icon: CalendarIcon },
  ];
  if (role === "parent") links.splice(3, 0, { to: `${base}/score`, label: "Score Predictor", icon: Gauge });
  return (
    <aside className={`transition-all ${open ? "w-56" : "w-16"} shrink-0 border-r border-gray-200 bg-white`}> 
      <button onClick={() => setOpen(!open)} className="m-3 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-xs shadow-sm hover:bg-gray-50">
        <Menu className="h-4 w-4" />
        {open && <span>Menu</span>}
      </button>
      <nav className="px-2 py-2 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm opacity-90 hover:bg-gray-100">
            <Icon className="h-4 w-4" />
            {open && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

//Variables to be used later
const studentTips = [
  "Set short daily goals",
  "Review mistakes weekly",
  "Use active recall",
  "Practice timed papers",
  "Sleep 8 hours",
  "Move your body",
  "Ask for help early",
];

const parentTips = [
  "Set a consistent study routine (same time/place).",
  "Model calm under stress; praise effort, not just results.",
  "Create a distraction-free zone (phones out during study).",
  "Do weekly check-ins focusing on roadblocks and next steps.",
  "Provide practice resources; track progress, not perfection.",
  "Prioritize sleep and nutrition during exam periods.",
  "Coordinate with teachers early if issues persist.",
];

function useRandomQuote() {
  const quotes = [
    "Small steps every day.",
    "Practice beats talent when talent doesn't practice.",
    "The man who does not read books has no advantage over the one who cannot read them.—Mark Twain" ,
    "Your future self is watching.",
    "Teachers can open the door, but you must enter it yourself.",
    "The beautiful thing about learning is that no one can take it away from you.",
    "A person who never made a mistake never tried anything new.—Albert Einstein",
    "Procrastination makes easy things hard and hard things harder.—Mason Cooley",
    "You don’t have to be great to start, but you have to start to be great."
  ];
  return useMemo(() => quotes[Math.floor(Math.random() * quotes.length)], []);
}

export function computeLockIn(examDate) {
  if (!examDate) return 5;
  const now = new Date();
  const d = new Date(examDate);
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 10;
  if (days > 180) return 3;
  const score = 10 - (days / 180) * 7;
  return Math.max(1, Math.min(10, Math.round(score)));
}
export function predictScore(practiceArr, lastExam) {
  const parsed = (practiceArr || []).map((p) => Number(p) || 0);
  const avgPractice = parsed.reduce((a, b) => a + b, 0) / (parsed.length || 1);
  const exam = Number(lastExam) || 0;
  return Math.round(0.6 * avgPractice + 0.4 * exam);
}

//Home page for students
function StudentHome() {
  const nav = useNavigate();
  const quote = useRandomQuote();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="text-2xl font-semibold md:text-3xl">Welcome to your personalized tutor!</h2>
      <p className="mt-2 text-sm text-gray-600">“{quote}”</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Tile onClick={() => nav("/student/chat")} icon={BrainCircuit} title="A.I. Chatbot" />
        <Tile onClick={() => nav("/student/tips")} icon={Lightbulb} title="Tips & Tricks" />
        <Tile onClick={() => nav("/student/schedule")} icon={CalendarIcon} title="Schedule" />
      </div>
    </div>
  );
}
function Tile({ onClick, icon: Icon, title }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="text-sm opacity-80">Open</p>
    </button>
  );
}

//Tips page for both students and parents
function TipsPage({ role }) {
  const items = role === "parent" ? parentTips : studentTips;
  return (
    <div className="flex">
      <SideNav role={role} />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-semibold md:text-3xl">Tips & Tricks ({role === "parent" ? "Parents" : "Students"})</h2>
        <ol className="list-decimal space-y-2 pl-6 text-sm">
          {items.map((t, i) => (<li key={i}>{t}</li>))}
        </ol>
      </div>
    </div>
  );
}

//Calendar
function getMonthMatrix(year, month /* 0-index */) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = (first.getDay() + 6) % 7; // Monday=0
  const total = last.getDate();
  const weeks = [];
  let day = 1 - startDay;
  while (day <= total) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(year, month, day);
      row.push({
        date: d,
        inMonth: d.getMonth() === month,
        key: d.toISOString().slice(0, 10),
      });
      day++;
    }
    weeks.push(row);
  }
  return weeks;
}

//Schedule page 
function StudentSchedule() {
  const [cursor, setCursor] = useState(() => new Date());
  const [activities, setActivities] = useState(() => storage.get(KEYS.STUDENT_ACTIVITIES, {}));
  const [filesByDay, setFilesByDay] = useState(() => storage.get(KEYS.ATTACHMENTS, {}));
  const [examDate, setExamDate] = useState(() => storage.get(KEYS.EXAM_DATE, ""));

  useEffect(() => storage.set(KEYS.STUDENT_ACTIVITIES, activities), [activities]);
  useEffect(() => storage.set(KEYS.ATTACHMENTS, filesByDay), [filesByDay]);
  useEffect(() => storage.set(KEYS.EXAM_DATE, examDate), [examDate]);

  const weeks = getMonthMatrix(cursor.getFullYear(), cursor.getMonth());
  const lockIn = computeLockIn(examDate);

  function addActivity(dateStr) {
    const text = prompt("What did you do?");
    if (!text) return;
    setActivities((prev) => ({ ...prev, [dateStr]: [...(prev[dateStr] || []), text] }));
  }
  function onUpload(dateStr, fileList) {
    const arr = Array.from(fileList || []).map((f) => ({ name: f.name, size: f.size }));
    setFilesByDay((prev) => ({ ...prev, [dateStr]: [...(prev[dateStr] || []), ...arr] }));
  }

  return (
    <div className="flex">
      <SideNav role="student" />
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-xl border border-gray-300 px-3 py-2 text-xs shadow-sm hover:bg-gray-50">Prev</button>
            <div className="text-base font-semibold">
              {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-xl border border-gray-300 px-3 py-2 text-xs shadow-sm hover:bg-gray-50">Next</button>
          </div>
          <label className="text-sm">
            <span className="mb-1 block opacity-80">Exam date</span>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <div className="text-sm opacity-80">Locked-in level: <span className="font-semibold">{lockIn}/10</span></div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="px-3 py-2">{d}</div>
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {weeks.map((row, r) => (
              <div key={r} className="grid grid-cols-7">
                {row.map((cell) => {
                  const acts = activities[cell.key] || [];
                  const files = filesByDay[cell.key] || [];
                  return (
                    <div
                      key={cell.key}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); onUpload(cell.key, e.dataTransfer.files); }}
                      className={`min-h-[120px] border-r border-gray-100 p-2 text-xs last:border-r-0 ${cell.inMonth ? "bg-white" : "bg-gray-50/60"}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className={`font-medium ${cell.inMonth ? "" : "opacity-60"}`}>{cell.date.getDate()}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => addActivity(cell.key)} className="rounded-md border px-2 py-0.5 hover:bg-gray-50">+</button>
                          <label className="rounded-md border px-2 py-0.5 hover:bg-gray-50 cursor-pointer">
                            <input type="file" className="hidden" multiple onChange={(e) => onUpload(cell.key, e.target.files)} />
                            <Upload className="h-3 w-3" />
                          </label>
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {acts.map((t, i) => (
                          <li key={i} className="rounded bg-indigo-50 px-2 py-1 text-[11px] text-indigo-800">{t}</li>
                        ))}
                      </ul>
                      {files.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {files.map((f, i) => (
                            <div key={i} className="truncate text-[11px] opacity-80">📎 {f.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs opacity-70">Tip: drag & drop files onto a day cell to attach them.</p>
      </div>
    </div>
  );
}

//Home page for parents
function ParentHome() {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="text-2xl font-semibold md:text-3xl">Welcome!</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Tile onClick={() => nav("/parent/chat")} icon={BrainCircuit} title="AI Chatbot" />
        <Tile onClick={() => nav("/parent/tips")} icon={Lightbulb} title="Tips & Tricks" />
        <Tile onClick={() => nav("/parent/schedule")} icon={CalendarIcon} title="Schedule" />
        <Tile onClick={() => nav("/parent/score")} icon={Gauge} title="Score Predictor" />
      </div>
    </div>
  );
}
//Schedule page for parents
function ParentSchedule() {
  const [target, setTarget] = useState(() => storage.get(KEYS.TARGET_SCORE, 75));
  const [examDate, setExamDate] = useState(() => storage.get(KEYS.EXAM_DATE, ""));
  const activities = storage.get(KEYS.STUDENT_ACTIVITIES, {});  
  const filesByDay = storage.get(KEYS.ATTACHMENTS, {});         
  const lockIn = computeLockIn(examDate);
  useEffect(() => storage.set(KEYS.TARGET_SCORE, target), [target]);

  // Shows what the student has been doing recently
  const recentItems = Object.keys({...activities, ...filesByDay})
    .filter(isISODate)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 7)
    .flatMap((day) => {
      const act = (activities[day] || []).map((t) => ({ type: "activity", text: t, day }));
      const fil = (filesByDay[day] || []).map((f) => ({ type: "file", name: f.name, day }));
      return [...act, ...fil];
    })
    .slice(0, 10);

  return (
    <div className="flex">
      <SideNav role="parent" />
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h2 className="mb-4 text-2xl font-semibold md:text-3xl">Schedule Overview</h2>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm">
          <p>Considering your target and how close PSLE is, the student should be <span className="font-semibold">{lockIn}/10</span> hardworking.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block opacity-80">Target score (/100)</span>
              <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label>
              <span className="mb-1 block opacity-80">Exam date</span>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-2 font-medium">Recent student activity & uploads:</div>
            {recentItems.length === 0 ? (
              <div className="opacity-70">No recent items yet.</div>
            ) : (
              <ul className="space-y-1">
                {recentItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{item.day}</span>
                    {item.type === "activity" ? (
                      <span>📝 {item.text}</span>
                    ) : (
                      <span>📎 {item.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

//Simple score predictor for parents
function ScorePredictor() {
  const [practice, setPractice] = useState(["", "", "", "", ""]);
  const [exam, setExam] = useState("");
  const predicted = predictScore(practice, exam);
  return (
    <div className="flex">
      <SideNav role="parent" />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-semibold md:text-3xl">Score Predictor</h2>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm">
          <div className="mb-2 font-medium">Last 5 Practice Papers – Scores (/100)</div>
          <div className="grid gap-2 md:grid-cols-5">
            {practice.map((p, i) => (
              <input key={i} value={p} onChange={(e) => setPractice((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder={`#${i + 1}`} />
            ))}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-[1fr,auto] md:items-end">
            <label>
              <span className="mb-1 block opacity-80">Last school exam score (/100)</span>
              <input value={exam} onChange={(e) => setExam(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <div className="rounded-xl bg-gray-100 px-4 py-3 text-sm">
              Therefore your predicted score: <span className="font-semibold">{Number.isFinite(predicted) ? predicted : 0}/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

//AI Chat page
function ChatPage({ role }) {
  const roleName = role === "parent" ? "parent" : "student";
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Hi ${roleName}! I’m your study coach. Ask me anything.` },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = React.useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading]);

  const add = (r, c) => setMessages((prev) => [...prev, { role: r, content: c }]);

  async function send(e) {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || isLoading) return;

    add("user", text);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat(
        [...messages, { role: "user", content: text }],
        (assistantText) => add("assistant", assistantText)
      );
    } catch (err) {
      const msg = err?.message ? ` (${err.message})` : "";
      add("assistant", "Sorry, I had trouble answering that." + msg);
    } finally {
      setIsLoading(false);
    }
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex">
      <SideNav role={roleName} />
      <div className="px-4 sm:px-6 md:px-8 py-6 max-w-4xl w-full">
        <h1 className="text-3xl font-semibold mb-4">How can I help you?</h1>

        {/* Chat window */}
        <div className="rounded-xl border bg-white shadow-sm h-[56vh] p-4">
          <div
            ref={listRef}
            className="h-full overflow-y-auto pr-1 space-y-3"
            aria-live="polite"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={
                  "max-w-[85%] px-3 py-2 rounded-2xl break-words " +
                  (m.role === "user"
                    ? "ml-auto bg-indigo-600 text-white"
                    : "mr-auto bg-gray-100 text-gray-900")
                }
              >
                {m.content}
              </div>
            ))}
            {isLoading && (
              <div className="mr-auto bg-gray-100 text-gray-600 px-3 py-2 rounded-2xl">
                Thinking…
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <form onSubmit={send} className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring"
            placeholder="Ask anything"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 disabled:opacity-50"
          >
            {isLoading ? "Sending…" : "Send"}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-2">
          Tip: Press ⌘/Ctrl + Enter to send.
        </p>
      </div>
    </div>
  );
}


//Layouts for student and parent
function StudentLayout() {
  return (
    <div className="flex">
      <SideNav role="student" />
      <StudentHome />
    </div>
  );
}
function ParentLayout() {
  return (
    <div className="flex">
      <SideNav role="parent" />
      <ParentHome />
    </div>
  );
}

//Main app component with routing
export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<Welcome />} />

            <Route path="/login/student" element={<Login role="student" />} />
            <Route path="/login/parent" element={<Login role="parent" />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Student */}
            <Route path="/student" element={<PrivateRoute><StudentLayout /></PrivateRoute>} />
            <Route path="/student/chat" element={<PrivateRoute><ChatPage role="student" /></PrivateRoute>} />
            <Route path="/student/tips" element={<PrivateRoute><TipsPage role="student" /></PrivateRoute>} />
            <Route path="/student/schedule" element={<PrivateRoute><StudentSchedule /></PrivateRoute>} />

            {/* Parent */}
            <Route path="/parent" element={<PrivateRoute><ParentLayout /></PrivateRoute>} />
            <Route path="/parent/chat" element={<PrivateRoute><ChatPage role="parent" /></PrivateRoute>} />
            <Route path="/parent/tips" element={<PrivateRoute><TipsPage role="parent" /></PrivateRoute>} />
            <Route path="/parent/schedule" element={<PrivateRoute><ParentSchedule /></PrivateRoute>} />
            <Route path="/parent/score" element={<PrivateRoute><ScorePredictor /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </AuthProvider>
    </HashRouter>
  );
}

// Simple dev tests for key functions
(function runDevTests() {
  try {
    const today = new Date();
    const past = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString().slice(0, 10);
    const far = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 200).toISOString().slice(0, 10);

    console.assert(computeLockIn("") === 5, "computeLockIn: empty -> 5");
    console.assert(computeLockIn(past) === 10, "computeLockIn: past -> 10");
    console.assert(computeLockIn(far) === 3, "computeLockIn: >180 days -> 3");

    const p1 = [80, 90, 70, 100, 60];
    const e1 = 75;
    const expected1 = Math.round(0.6 * (p1.reduce((a,b)=>a+b,0)/5) + 0.4 * e1);
    console.assert(predictScore(p1, e1) === expected1, "predictScore: mixed numbers");

    const p2 = ["", "", "", "", ""];
    console.assert(predictScore(p2, "") === 0, "predictScore: blanks -> 0");
  } catch (err) {
    console.warn("Dev tests failed:", err);
  }
})();
