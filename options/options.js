(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const requestedOrigin = params.get("origin");
  const requestedTabId = params.has("tabId") ? Number(params.get("tabId")) : null;

  if (requestedOrigin) $("origin").value = requestedOrigin;

  function notify(text, kind) {
    const el = $("grant-msg");
    el.textContent = text;
    el.className = `notice show ${kind}`;
  }

  function siteRow(origin) {
    const url = new URL(origin);

    const item = document.createElement("li");
    item.className = "site";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = (url.hostname.match(/[a-z]/i)?.[0] ?? "#").toUpperCase();
    avatar.setAttribute("aria-hidden", "true");

    const text = document.createElement("div");
    text.className = "site-text";
    const host = document.createElement("div");
    host.className = "site-host";
    host.textContent = url.port ? `${url.hostname}:${url.port}` : url.hostname;
    const address = document.createElement("div");
    address.className = "site-origin";
    address.textContent = origin;
    text.append(host, address);

    const pill = document.createElement("span");
    pill.className = "pill success";
    pill.textContent = "Active";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${origin}`);
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      await MMSites.disable(origin);
      notify(`Removed ${origin}. Reload open pages to stop rendering there.`, "success");
      refresh();
    });

    item.append(avatar, text, pill, remove);
    return item;
  }

  async function refresh() {
    const sites = await MMSites.reconcile();
    const list = $("sites");
    list.replaceChildren(...sites.map(siteRow));
    list.hidden = sites.length === 0;
    $("empty").hidden = sites.length > 0;
    $("count").textContent = `${sites.length} ${sites.length === 1 ? "site" : "sites"}`;
  }

  async function allow() {
    const button = $("grant");
    const origin = MMSites.normalizeOrigin($("origin").value.trim());
    if (!origin) {
      notify("Enter a full address such as https://tfs.contoso.local", "error");
      return;
    }

    const tabId = origin === requestedOrigin ? requestedTabId : null;
    button.disabled = true;
    try {
      const granted = await MMSites.enable(origin, tabId);
      if (granted) {
        $("origin").value = "";
        notify(`${origin} is allowed. Diagrams will render on its pages.`, "success");
      } else {
        notify(`Access to ${origin} was not granted.`, "error");
      }
    } catch (error) {
      notify(`Could not allow ${origin}: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
    refresh();
  }

  $("grant").addEventListener("click", allow);
  $("origin").addEventListener("keydown", (event) => {
    if (event.key === "Enter") allow();
  });

  refresh();
})();
