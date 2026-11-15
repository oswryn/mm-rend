(() => {
  const CONTENT_JS = ["content/detect.js", "content/inject.js", "content/content.js"];
  const CONTENT_CSS = ["content/content.css"];
  const STORAGE_KEY = "enabledOrigins";

  function normalizeOrigin(input) {
    let url;
    try {
      url = new URL(input.includes("://") ? input : `https://${input}`);
    } catch {
      return null;
    }
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  }

  const patternFor = (origin) => `${origin}/*`;
  const scriptIdFor = (origin) => `mm-rend-${origin.replace(/[^a-z0-9]/gi, "_")}`;

  async function getEnabled() {
    const { [STORAGE_KEY]: list = [] } = await chrome.storage.local.get(STORAGE_KEY);
    return list;
  }

  async function setEnabled(list) {
    await chrome.storage.local.set({ [STORAGE_KEY]: [...new Set(list)].sort() });
  }

  async function registerScripts(origin) {
    const script = {
      id: scriptIdFor(origin),
      matches: [patternFor(origin)],
      js: CONTENT_JS,
      css: CONTENT_CSS,
      runAt: "document_idle",
      allFrames: false,
      persistAcrossSessions: true,
    };
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [script.id] });
    if (existing.length) {
      await chrome.scripting.updateContentScripts([script]);
    } else {
      await chrome.scripting.registerContentScripts([script]);
    }
  }

  async function unregisterScripts(origin) {
    await chrome.scripting.unregisterContentScripts({ ids: [scriptIdFor(origin)] }).catch(() => {});
  }

  async function hasPermission(origin) {
    return chrome.permissions.contains({ origins: [patternFor(origin)] });
  }

  async function injectInto(tabId) {
    await chrome.scripting.insertCSS({ target: { tabId }, files: CONTENT_CSS }).catch(() => {});
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_JS }).catch(() => {});
  }

  // Must be called synchronously from a user gesture so the permission prompt can appear.
  async function enable(origin, tabId = null) {
    const granted = await chrome.permissions.request({ origins: [patternFor(origin)] });
    if (!granted) return false;

    await registerScripts(origin);
    await setEnabled([...(await getEnabled()), origin]);
    if (tabId != null) await injectInto(tabId);
    return true;
  }

  async function disable(origin) {
    await unregisterScripts(origin);
    await chrome.permissions.remove({ origins: [patternFor(origin)] }).catch(() => {});
    await setEnabled((await getEnabled()).filter((o) => o !== origin));
  }

  // Drops origins whose permission was revoked from chrome://extensions and re-registers the rest.
  async function reconcile() {
    const kept = [];
    for (const origin of await getEnabled()) {
      if (await hasPermission(origin)) {
        await registerScripts(origin);
        kept.push(origin);
      } else {
        await unregisterScripts(origin);
      }
    }
    await setEnabled(kept);
    return kept;
  }

  globalThis.MMSites = {
    normalizeOrigin,
    patternFor,
    getEnabled,
    hasPermission,
    enable,
    disable,
    reconcile,
  };
})();
