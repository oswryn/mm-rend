(() => {
  const NS = (globalThis.MMRend ??= {});

  const BASE_CSS = `
    :host {
      display: block;
      margin: 12px 0;
      font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: inherit;
    }
    .card {
      margin: 0;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: 10px;
      background: transparent;
      color: inherit;
      overflow: hidden;
    }
    .card[data-bg="light"] {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }
    .card[data-bg="dark"] {
      background: #111827;
      color: #e5e7eb;
      border-color: rgba(148, 163, 184, 0.25);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      background: color-mix(in srgb, currentColor 4%, transparent);
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .label::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 2px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
    }
    button {
      font: inherit;
      font-size: 12px;
      padding: 3px 10px;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    button:hover {
      border-color: #2563eb;
      color: #2563eb;
    }
    button:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
    .diagram {
      overflow: auto;
      padding: 12px;
    }
    .diagram svg {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
    }
    .card.error {
      border-left: 3px solid #d92d20;
    }
    .card.error .label::before {
      background: #d92d20;
    }
    .error-text {
      padding: 10px 12px;
      white-space: pre-wrap;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
      color: #b42318;
    }
    .card[data-bg="dark"] .error-text {
      color: #fda29b;
    }
    .note {
      padding: 0 12px 10px;
      font-size: 12px;
      opacity: 0.7;
    }
  `;

  const sheetFrom = (css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  };

  function parseSvg(svgText) {
    const template = document.createElement("template");
    template.innerHTML = svgText;
    const svg = template.content.querySelector("svg");
    if (!svg) throw new Error("Renderer did not return an SVG diagram");
    return document.importNode(svg, true);
  }

  // Page CSP may block inline <style> and style attributes that Mermaid emits.
  // Constructed stylesheets and CSSOM writes are not subject to that restriction.
  function liftInlineStyles(svg) {
    const css = [];
    svg.querySelectorAll("style").forEach((el) => {
      css.push(el.textContent);
      el.remove();
    });
    svg.querySelectorAll("[style]").forEach((el) => {
      const value = el.getAttribute("style");
      el.removeAttribute("style");
      el.style.cssText = value;
    });
    return css;
  }

  // Page CSS such as `pre { display: block }` overrides the hidden attribute,
  // so visibility is enforced with an inline !important declaration.
  function setSourceVisible(pre, visible) {
    pre.hidden = !visible;
    if (visible) {
      pre.style.removeProperty("display");
    } else {
      pre.style.setProperty("display", "none", "important");
    }
  }

  function createCard(pre, variant, background) {
    const host = document.createElement("div");
    host.className = "mm-rend-host";
    const root = host.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = [sheetFrom(BASE_CSS)];
    const card = document.createElement("figure");
    card.className = variant === "error" ? "card error" : "card";
    card.dataset.bg = background;
    root.append(card);
    const previous = pre.previousElementSibling;
    if (previous?.classList.contains("mm-rend-host")) previous.remove();
    pre.before(host);
    return { root, card };
  }

  function addToolbar(card, pre) {
    const bar = document.createElement("div");
    bar.className = "bar";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = "Mermaid";
    const button = document.createElement("button");
    button.type = "button";
    const sync = () => {
      button.textContent = pre.hidden ? "Show source" : "Hide source";
      button.setAttribute("aria-expanded", String(!pre.hidden));
    };
    button.addEventListener("click", () => {
      setSourceVisible(pre, pre.hidden);
      sync();
    });
    bar.append(label, button);
    card.append(bar);
    sync();
  }

  NS.renderDiagram = function renderDiagram(pre, svgText, background = "page") {
    const svg = parseSvg(svgText);
    const styles = liftInlineStyles(svg);

    const { root, card } = createCard(pre, "diagram", background);
    if (styles.length) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...styles.map(sheetFrom)];
    }
    setSourceVisible(pre, false);
    addToolbar(card, pre);

    const diagram = document.createElement("div");
    diagram.className = "diagram";
    diagram.append(svg);
    card.append(diagram);
  };

  NS.showError = function showError(pre, message, background = "page") {
    const { card } = createCard(pre, "error", background);
    const bar = document.createElement("div");
    bar.className = "bar";
    const title = document.createElement("span");
    title.className = "label";
    title.textContent = "Mermaid error";
    bar.append(title);
    const text = document.createElement("div");
    text.className = "error-text";
    text.textContent = message;
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = "The source below could not be drawn.";
    card.append(bar, text, note);
    setSourceVisible(pre, true);
  };
})();
