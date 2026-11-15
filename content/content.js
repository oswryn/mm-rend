(() => {
  const NS = globalThis.MMRend;
  if (!NS || NS.started) return;
  NS.started = true;

  const runId = Math.random().toString(36).slice(2, 8);
  let counter = 0;
  const sources = new Map();

  async function renderBlock({ pre, source }) {
    pre.dataset.mmRend = "pending";
    sources.set(pre, source);
    const id = `mmrend-${runId}-${counter++}`;

    let background = MMSettings.DEFAULTS.background;
    try {
      const settings = await MMSettings.get();
      background = settings.background;
      const theme = MMSettings.resolveTheme(settings, MMSettings.pageIsDark(pre.parentElement ?? pre));
      const response = await chrome.runtime.sendMessage({ type: "MM_RENDER", id, source, theme });
      if (!response?.ok) throw new Error(response?.error ?? "no response from renderer");
      NS.renderDiagram(pre, response.svg, background);
      pre.dataset.mmRend = "done";
    } catch (error) {
      NS.showError(pre, error.message, background);
      pre.dataset.mmRend = "error";
    }
  }

  function scan() {
    for (const block of NS.findBlocks(document)) {
      renderBlock(block);
    }
  }

  function rerenderAll() {
    for (const [pre, source] of sources) {
      if (!pre.isConnected) {
        sources.delete(pre);
        continue;
      }
      renderBlock({ pre, source });
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) rerenderAll();
  });

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 150);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scan();
})();
