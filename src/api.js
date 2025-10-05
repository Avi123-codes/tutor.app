const API_BASE = ''; 

async function jsonOrThrow(res) {
  let bodyText = '';
  try { bodyText = await res.text(); } catch {}
  let json;
  try { json = bodyText ? JSON.parse(bodyText) : null; } catch { json = null; }
  if (!res.ok) {
    const reason = json?.error || bodyText || `HTTP ${res.status}`;
    throw new Error(reason);
  }
  return json ?? {};
}

export async function streamChat(messages, onAssistantText) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const data = await jsonOrThrow(res);
  if (typeof onAssistantText === 'function') onAssistantText(data.text ?? '');
}

export async function chatWithImage(file, prompt, onAssistantText) {
  const form = new FormData();
  form.append('image', file);
  form.append('prompt', prompt);

  const res = await fetch('/api/chat-image', { method: 'POST', body: form });
  const data = await jsonOrThrow(res);
  if (typeof onAssistantText === 'function') onAssistantText(data.text ?? '');
}
