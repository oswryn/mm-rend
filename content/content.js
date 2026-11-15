(() => {
  const NS = globalThis.MMRend;
  if (!NS || NS.started) return;
  NS.started = true;

  const runId = Math.random().toString(36).slice(2, 8);
  let counter = 0;

  function renderBlock({ pre, source }) {
    pre.dataset.mmRend = "pending";
    const id = `mmrend-${runId}-${counter++}`;

    chrome.runtime
      .sendMessage({ type: "MM_RENDER", id, source })
      .then((response) => {
        if (!response?.ok) throw new Error(response?.error ?? "no response from renderer");
        NS.renderDiagram(pre, response.svg);
        pre.dataset.mmRend = "done";
      })
      .catch((error) => {
        NS.showError(pre, error.message);
        pre.dataset.mmRend = "error";
      });
  }

  function scan() {
    for (const block of NS.findBlocks(document)) {
      renderBlock(block);
    }
  }

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 150);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scan();
})();
