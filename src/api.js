const API_BASE =
  (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, "")) ||
  "";

// Helper to parse JSON or throw with detail
async function jsonOrThrow(res) {
  let text = "";
  try { text = await res.text(); } catch {}
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const reason = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
    throw new Error(reason);
  }
  return json ?? {};
}

export async function streamChat(messages, onAssistantText) {
  const url = `${API_BASE}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const data = await jsonOrThrow(res);
  if (typeof onAssistantText === "function") onAssistantText(data.text ?? "");
}

export async function chatWithImage(file, prompt, onAssistantText) {
  const url = `${API_BASE}/api/chat-image`;
  const form = new FormData();
  form.append("image", file);
  form.append("prompt", prompt || "");

  const res = await fetch(url, { method: "POST", body: form });
  const data = await jsonOrThrow(res);
  if (typeof onAssistantText === "function") onAssistantText(data.text ?? "");
}
