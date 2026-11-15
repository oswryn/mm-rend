(() => {
  const NS = (globalThis.MMRend ??= {});

  const BASE_CSS = `
    :host { display: block; font: 13px/1.4 system-ui, sans-serif; color: inherit; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; font-size: 12px; opacity: 0.75; }
    button { font: inherit; padding: 2px 8px; border: 1px solid currentColor; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
    .diagram { overflow: auto; padding: 8px 0; }
    .diagram svg { max-width: 100%; height: auto; }
    .error { color: #b42318; white-space: pre-wrap; font: 12px/1.4 ui-monospace, Consolas, monospace; }
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

  function createHost(pre) {
    const host = document.createElement("div");
    host.className = "mm-rend-host";
    const root = host.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = [sheetFrom(BASE_CSS)];
    pre.before(host);
    return root;
  }

  function addSourceToggle(root, pre) {
    const bar = document.createElement("div");
    bar.className = "bar";
    const label = document.createElement("span");
    label.textContent = "Mermaid diagram";
    const button = document.createElement("button");
    button.type = "button";
    const sync = () => {
      button.textContent = pre.hidden ? "Show source" : "Hide source";
    };
    button.addEventListener("click", () => {
      pre.hidden = !pre.hidden;
      sync();
    });
    bar.append(label, button);
    root.append(bar);
    sync();
  }

  NS.renderDiagram = function renderDiagram(pre, svgText) {
    const svg = parseSvg(svgText);
    const styles = liftInlineStyles(svg);

    const root = createHost(pre);
    if (styles.length) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...styles.map(sheetFrom)];
    }
    pre.hidden = true;
    addSourceToggle(root, pre);

    const diagram = document.createElement("div");
    diagram.className = "diagram";
    diagram.append(svg);
    root.append(diagram);
  };

  NS.showError = function showError(pre, message) {
    const root = createHost(pre);
    const error = document.createElement("div");
    error.className = "error";
    error.textContent = `Mermaid could not render this block: ${message}`;
    root.append(error);
    pre.hidden = false;
  };
})();
