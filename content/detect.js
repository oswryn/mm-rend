(() => {
  const NS = (globalThis.MMRend ??= {});

  const DIAGRAM_START = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|journey|timeline|mindmap|requirementDiagram|C4(Context|Container|Component|Dynamic|Deployment)|quadrantChart|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban|zenuml)\b/;
  const MERMAID_TOKEN = /^(language-|lang-)?mermaid$/i;
  const LANGUAGE_TOKEN = /^(language-|lang-)/i;

  const classTokens = (el) => (el ? Array.from(el.classList) : []);
  const hasMermaidClass = (el) => classTokens(el).some((token) => MERMAID_TOKEN.test(token));
  const hasLanguageClass = (el) => classTokens(el).some((token) => LANGUAGE_TOKEN.test(token));

  function extractSource(el) {
    return el.textContent.replace(/\u00a0/g, " ").replace(/^\s*\n/, "").trimEnd();
  }

  function firstNonEmptyLine(source) {
    return source.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
  }

  NS.findBlocks = function findBlocks(root) {
    const blocks = [];
    root.querySelectorAll("pre").forEach((pre) => {
      if (pre.dataset.mmRend || pre.closest(".mermaid, .mm-rend-host")) return;

      const code = pre.querySelector(":scope > code");
      const source = extractSource(code ?? pre);
      if (!source) return;

      const explicit = hasMermaidClass(pre) || hasMermaidClass(code);
      const unlabeled = !hasLanguageClass(pre) && !hasLanguageClass(code);
      if (explicit || (unlabeled && DIAGRAM_START.test(firstNonEmptyLine(source)))) {
        blocks.push({ pre, source });
      }
    });
    return blocks;
  };
})();
