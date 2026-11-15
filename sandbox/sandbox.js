const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

if (typeof mermaid !== "undefined") {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: prefersDark ? "dark" : "default",
  });
}

window.parent.postMessage({ target: "mm-offscreen", type: "ready" }, "*");

let renderCount = 0;

window.addEventListener("message", async (event) => {
  if (event.source !== window.parent) return;
  const { target, id, source } = event.data ?? {};
  if (target !== "mm-sandbox") return;

  const renderId = `mmsb-${renderCount++}`;
  let reply;
  try {
    if (typeof mermaid === "undefined") throw new Error("Mermaid library failed to load");
    const { svg } = await mermaid.render(renderId, source);
    reply = { ok: true, svg };
  } catch (error) {
    reply = { ok: false, error: String(error?.message ?? error) };
  } finally {
    document.querySelectorAll(`[id="${renderId}"], [id="d${renderId}"]`).forEach((el) => el.remove());
  }

  window.parent.postMessage({ target: "mm-offscreen", id, ...reply }, "*");
});
