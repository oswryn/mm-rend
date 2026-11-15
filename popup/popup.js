(async () => {
  const $ = (id) => document.getElementById(id);

  $("manage").addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const origin = tab?.url ? MMSites.normalizeOrigin(tab.url) : null;

  if (!origin) {
    $("site").textContent = "Mermaid fences can only be rendered on http and https pages.";
    $("hint").textContent = "Open an Azure DevOps page to get started.";
    return;
  }

  const enabled = (await MMSites.getEnabled()).includes(origin) && (await MMSites.hasPermission(origin));
  $("site").textContent = new URL(origin).host;

  const status = $("status");
  status.hidden = false;
  status.className = enabled ? "pill success" : "pill neutral";
  status.textContent = enabled ? "Active" : "Off";

  $("hint").textContent = enabled
    ? "Fenced mermaid blocks are drawn on this site. Reload open pages after stopping."
    : "Mermaid fences on this site are shown as plain code until you allow it.";

  $("enable").hidden = enabled;
  $("disable").hidden = !enabled;

  $("enable").addEventListener("click", () => {
    const params = new URLSearchParams({ origin, tabId: String(tab.id) });
    chrome.tabs.create({ url: chrome.runtime.getURL(`options/options.html?${params}`) });
    window.close();
  });

  $("disable").addEventListener("click", async () => {
    await MMSites.disable(origin);
    window.location.reload();
  });
})();
