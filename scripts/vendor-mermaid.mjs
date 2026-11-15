import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "mermaid", "dist", "mermaid.min.js");
const dest = path.join(root, "vendor", "mermaid.min.js");

await mkdir(path.dirname(dest), { recursive: true });
await copyFile(src, dest);

const bundle = await readFile(dest, "utf8");
if (/\bimport\(\s*["'`]/.test(bundle)) {
  throw new Error("vendor/mermaid.min.js contains dynamic imports; the bundle must be self-contained");
}

const pkg = JSON.parse(await readFile(path.join(root, "node_modules", "mermaid", "package.json"), "utf8"));
console.log(`Vendored mermaid ${pkg.version} -> vendor/mermaid.min.js`);
