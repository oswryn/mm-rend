(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const requestedOrigin = params.get("origin");
  const requestedTabId = params.has("tabId") ? Number(params.get("tabId")) : null;

  if (requestedOrigin) $("origin").value = requestedOrigin;

  function showMessage(text) {
    $("grant-msg").textContent = text;
  }

  async function refresh() {
    const sites = await MMSites.reconcile();
    const list = $("sites");
    list.replaceChildren();

    for (const origin of sites) {
      const item = document.createElement("li");
      const label = document.createElement("code");
      label.textContent = origin;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        await MMSites.disable(origin);
        showMessage(`Removed ${origin}. Reload open pages to stop rendering there.`);
        refresh();
      });
      item.append(label, remove);
      list.append(item);
    }

    $("empty").hidden = sites.length > 0;
  }

  $("grant").addEventListener("click", async () => {
    const origin = MMSites.normalizeOrigin($("origin").value.trim());
    if (!origin) {
      showMessage("Enter a full http or https URL, for example https://tfs.contoso.local");
      return;
    }

    const tabId = origin === requestedOrigin ? requestedTabId : null;
    const granted = await MMSites.enable(origin, tabId);
    showMessage(granted ? `Enabled on ${origin}.` : `Permission was not granted for ${origin}.`);
    refresh();
  });

  refresh();
})();
