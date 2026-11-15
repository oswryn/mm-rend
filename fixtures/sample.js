document.getElementById("add")?.addEventListener("click", () => {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "language-mermaid";
  code.textContent = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';
  pre.append(code);
  document.getElementById("dynamic").append(pre);
});
