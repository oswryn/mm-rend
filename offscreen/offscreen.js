const RENDER_TIMEOUT_MS = 20000;

const frame = document.getElementById("sandbox");
const pending = new Map();

let markReady;
const ready = new Promise((resolve) => {
  markReady = resolve;
});

window.addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow) return;
  const data = event.data;
  if (data?.target !== "mm-offscreen") return;

  if (data.type === "ready") {
    markReady();
    return;
  }

  const entry = pending.get(data.id);
  if (!entry) return;
  pending.delete(data.id);
  clearTimeout(entry.timer);
  entry.resolve(data.ok ? { ok: true, svg: data.svg } : { ok: false, error: data.error });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "mm-offscreen" || message.type !== "render") return false;

  const { id, source, theme } = message;
  const reply = new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, error: "rendering timed out" });
    }, RENDER_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
  });

  ready.then(() => {
    frame.contentWindow.postMessage({ target: "mm-sandbox", id, source, theme }, "*");
  });
  reply.then(sendResponse);
  return true;
});
