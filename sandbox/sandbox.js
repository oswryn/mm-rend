const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const DARK_VARIABLES = {
  darkMode: true,
  background: "transparent",
  primaryColor: "#1e293b",
  primaryBorderColor: "#60a5fa",
  primaryTextColor: "#e2e8f0",
  secondaryColor: "#312e81",
  tertiaryColor: "#0f172a",
  lineColor: "#94a3b8",
  textColor: "#e2e8f0",
  mainBkg: "#1e293b",
  nodeBorder: "#60a5fa",
  clusterBkg: "#111827",
  clusterBorder: "#334155",
  titleColor: "#e2e8f0",
  edgeLabelBackground: "#0f172a",
  actorBkg: "#1e293b",
  actorBorder: "#60a5fa",
  actorTextColor: "#e2e8f0",
  signalColor: "#94a3b8",
  signalTextColor: "#e2e8f0",
  noteBkgColor: "#312e81",
  noteTextColor: "#e2e8f0",
  noteBorderColor: "#6366f1",
};

// Mermaid's built-in dark theme has nodes that are barely distinct from a dark page,
// so dark uses the base theme with explicit variables.
function themeConfig(theme) {
  if (theme === "dark") return { theme: "base", themeVariables: DARK_VARIABLES };
  return { theme };
}

window.parent.postMessage({ target: "mm-offscreen", type: "ready" }, "*");

let renderCount = 0;

window.addEventListener("message", async (event) => {
  if (event.source !== window.parent) return;
  const { target, id, source, theme } = event.data ?? {};
  if (target !== "mm-sandbox") return;

  const renderId = `mmsb-${renderCount++}`;
  let reply;
  try {
    if (typeof mermaid === "undefined") throw new Error("Mermaid library failed to load");
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      ...themeConfig(theme ?? (prefersDark ? "dark" : "default")),
    });
    const { svg } = await mermaid.render(renderId, source);
    reply = { ok: true, svg };
  } catch (error) {
    reply = { ok: false, error: String(error?.message ?? error) };
  } finally {
    document.querySelectorAll(`[id="${renderId}"], [id="d${renderId}"]`).forEach((el) => el.remove());
  }

  window.parent.postMessage({ target: "mm-offscreen", id, ...reply }, "*");
});
