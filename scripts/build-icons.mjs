import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(path.join(root, "icons", "icon.svg"), "utf8");
const sizes = [16, 48, 128];
const chromePath = process.env.CHROME_PATH ?? "google-chrome";

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  for (const size of sizes) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
         <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"
              width="${size}" height="${size}" style="display:block"></body></html>`,
      { waitUntil: "load" },
    );
    await page.screenshot({
      path: path.join(root, "icons", `icon${size}.png`),
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
  }
  console.log(`Wrote ${sizes.map((s) => `icon${s}.png`).join(", ")}`);
} finally {
  await browser.close();
}
