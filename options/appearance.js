(() => {
  const $ = (id) => document.getElementById(id);
  const SAMPLE = [
    "flowchart LR",
    "  Source[Mermaid fence] --> Render{Render locally}",
    "  Render -->|light or dark| Diagram[Diagram]",
  ].join("\n");

  let previewSeq = 0;
  let savedTimer = null;

  function showSaved() {
    const pill = $("save-state");
    pill.hidden = false;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      pill.hidden = true;
    }, 1600);
  }

  async function renderPreview(settings) {
    const seq = ++previewSeq;
    const preview = $("preview");
    const status = $("preview-status");
    preview.dataset.bg = settings.background;

    const theme = MMSettings.resolveTheme(settings, MMSettings.pageIsDark(preview));
    const reply = await chrome.runtime.sendMessage({
      type: "MM_RENDER",
      id: `preview-${seq}`,
      source: SAMPLE,
      theme,
    });
    if (seq !== previewSeq) return;

    if (reply?.ok) {
      $("preview-svg").innerHTML = reply.svg;
      status.textContent = "";
    } else {
      $("preview-svg").replaceChildren();
      status.textContent = `Preview unavailable: ${reply?.error ?? "no response from renderer"}`;
    }
  }

  async function save() {
    await MMSettings.set({ theme: $("theme").value, background: $("background").value });
    showSaved();
    renderPreview(await MMSettings.get());
  }

  async function init() {
    const settings = await MMSettings.get();
    $("theme").value = settings.theme;
    $("background").value = settings.background;
    $("theme").addEventListener("change", save);
    $("background").addEventListener("change", save);
    renderPreview(settings);
  }

  init();
})();
