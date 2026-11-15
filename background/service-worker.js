const OFFSCREEN_PATH = "offscreen/offscreen.html";

let creatingOffscreen = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creatingOffscreen ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["IFRAME_SCRIPTING"],
      justification: "Render Mermaid diagrams locally in a sandboxed iframe that permits the bundled library's parser.",
    })
    .finally(() => {
      creatingOffscreen = null;
    });
  await creatingOffscreen;
}

async function renderInOffscreen(id, source) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: "mm-offscreen", type: "render", id, source });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MM_RENDER" || !sender.tab) return false;

  renderInOffscreen(message.id, message.source)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
