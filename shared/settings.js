(() => {
  const DEFAULTS = Object.freeze({ theme: "auto", background: "page" });
  const THEMES = ["auto", "default", "dark", "neutral", "forest"];
  const BACKGROUNDS = ["page", "light", "dark"];

  async function get() {
    const { settings } = await chrome.storage.sync.get("settings");
    return { ...DEFAULTS, ...(settings ?? {}) };
  }

  async function set(patch) {
    const current = await get();
    await chrome.storage.sync.set({ settings: { ...current, ...patch } });
  }

  function parseRgba(color) {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const [r, g, b, a = 1] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }

  // The diagram sits on whatever is behind it, so brightness is taken from the
  // nearest opaque background up the tree rather than from the OS colour scheme.
  function pageIsDark(element) {
    for (let node = element; node; node = node.parentElement) {
      const rgba = parseRgba(getComputedStyle(node).backgroundColor);
      if (rgba && rgba.a > 0.5) {
        return 0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b < 128;
      }
    }
    return false;
  }

  function resolveTheme({ theme, background }, pageDark) {
    if (theme !== "auto") return theme;
    const dark = background === "dark" || (background === "page" && pageDark);
    return dark ? "dark" : "default";
  }

  globalThis.MMSettings = { DEFAULTS, THEMES, BACKGROUNDS, get, set, pageIsDark, resolveTheme };
})();
