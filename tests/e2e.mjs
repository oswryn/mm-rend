// End-to-end test: loads the unpacked extension in Chromium, enables it for a
// local fixture origin via the options page, and checks rendering in the page.
//
// A test copy of the manifest lists the fixture host as a static host permission.
// Chrome then reports it as already granted, so chrome.permissions.request resolves
// without the interactive prompt (which headless Chrome cannot answer).
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.CHROME_PATH ?? "google-chrome";
const CONTENT_TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const SHIPPED = ["background", "content", "offscreen", "options", "popup", "sandbox", "shared", "vendor", "icons"];

async function buildTestExtension() {
  const dir = await mkdtemp(path.join(tmpdir(), "mm-rend-e2e-"));
  for (const entry of [...SHIPPED, "manifest.json"]) {
    await cp(path.join(repo, entry), path.join(dir, entry), { recursive: true });
  }
  const manifest = JSON.parse(await readFile(path.join(repo, "manifest.json"), "utf8"));
  manifest.host_permissions = ["http://127.0.0.1/*"];
  manifest.optional_host_permissions = ["http://*/*", "https://*/*"];
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

function startFixtureServer() {
  const server = createServer(async (req, res) => {
    const urlPath = new URL(req.url, "http://127.0.0.1").pathname;
    const file = path.join(repo, "fixtures", urlPath === "/" ? "sample.html" : urlPath);
    try {
      await stat(file);
    } catch {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const waitForRenders = (page, count) =>
  page.waitForFunction(
    (n) => document.querySelectorAll('pre[data-mm-rend="done"]').length === n,
    { timeout: 30000, polling: 250 },
    count,
  );

async function main() {
  const extensionDir = await buildTestExtension();
  const server = await startFixtureServer();
  const origin = `http://127.0.0.1:${server.address().port}`;

  const networkUrls = [];
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
    ],
  });

  const watchNetwork = async (target) => {
    try {
      const session = await target.createCDPSession();
      await session.send("Network.enable");
      session.on("Network.requestWillBeSent", (event) => networkUrls.push(event.request.url));
    } catch {
      // Some targets (for example, closed pages) cannot be observed.
    }
  };
  browser.on("targetcreated", watchNetwork);
  for (const target of browser.targets()) await watchNetwork(target);

  const results = [];
  const check = async (name, fn) => {
    try {
      await fn();
      results.push(`PASS ${name}`);
    } catch (error) {
      results.push(`FAIL ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  };

  try {
    const sw = await browser.waitForTarget(
      (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
    );
    const extensionId = new URL(sw.url()).host;

    await check("origin normalisation", async () => {
      const options = await browser.newPage();
      await options.goto(`chrome-extension://${extensionId}/options/options.html`);
      const cases = await options.evaluate(() => ({
        bare: MMSites.normalizeOrigin("tfs.contoso.local"),
        port: MMSites.normalizeOrigin("http://tfs.contoso.local:8080/tfs/DefaultCollection"),
        ftp: MMSites.normalizeOrigin("ftp://tfs.contoso.local"),
        junk: MMSites.normalizeOrigin("not a url ::"),
      }));
      assert.deepEqual(cases, {
        bare: "https://tfs.contoso.local",
        port: "http://tfs.contoso.local:8080",
        ftp: null,
        junk: null,
      });
      await options.close();
    });

    await check("popup explains that extension pages cannot host diagrams", async () => {
      const popup = await browser.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await popup.waitForFunction(() => !document.getElementById("site").textContent.startsWith("Checking"), {
        timeout: 10000,
        polling: 250,
      });
      const text = await popup.$eval("#site", (el) => el.textContent);
      assert.match(text, /only be rendered on http and https/);
      await popup.close();
    });

    const page = await browser.newPage();
    await page.bringToFront();
    await page.goto(`${origin}/sample.html`, { waitUntil: "load" });
    const extPage = await browser.newPage();
    await extPage.goto(`chrome-extension://${extensionId}/options/options.html`);
    const tabId = await extPage.evaluate(
      async (prefix) => (await chrome.tabs.query({})).find((t) => t.url?.startsWith(prefix))?.id,
      origin,
    );
    await extPage.close();
    assert.ok(tabId, "fixture tab should be visible to the extension");

    await check("nothing renders before the site is enabled", async () => {
      const count = await page.$$eval('pre[data-mm-rend]', (els) => els.length);
      assert.equal(count, 0);
    });

    const options = await browser.newPage();
    await options.goto(
      `chrome-extension://${extensionId}/options/options.html?origin=${encodeURIComponent(origin)}&tabId=${tabId}`,
    );
    await options.click("#grant");
    await options.waitForFunction(
      () => document.getElementById("grant-msg").textContent.startsWith("Enabled on"),
      { timeout: 15000, polling: 250 },
    );

    await check("enabled site renders valid fences in the open tab without reload", async () => {
      await waitForRenders(page, 3);
    });

    await check("diagrams are shadow-DOM SVG and laid out", async () => {
      const info = await page.evaluate(() =>
        [...document.querySelectorAll(".mm-rend-host")].map((host) => {
          const svg = host.shadowRoot?.querySelector("svg");
          const box = svg?.getBBox?.();
          return { hasSvg: Boolean(svg), width: box?.width ?? 0 };
        }),
      );
      assert.equal(info.length, 4, "three diagrams plus one error host");
      assert.equal(info.filter((i) => i.hasSvg).length, 3);
      assert.ok(info.filter((i) => i.hasSvg).every((i) => i.width > 0));
    });

    await check("invalid fence shows error and keeps source visible", async () => {
      const state = await page.evaluate(() => {
        const pre = document.querySelector('pre[data-mm-rend="error"]');
        const host = pre.previousElementSibling;
        return { hidden: pre.hidden, errorText: host.shadowRoot.querySelector(".error")?.textContent ?? "" };
      });
      assert.equal(state.hidden, false);
      assert.match(state.errorText, /could not render/);
    });

    await check("non-mermaid and native-container blocks are untouched", async () => {
      const untouched = await page.evaluate(() => {
        const js = document.querySelector("code.language-js").parentElement;
        const plain = [...document.querySelectorAll("pre")].find((p) => p.textContent.includes("Just some plain"));
        const native = document.querySelector(".mermaid pre");
        return [js, plain, native].map((el) => el.dataset.mmRend ?? null);
      });
      assert.deepEqual(untouched, [null, null, null]);
    });

    await check("Show source toggles the original fence", async () => {
      const result = await page.evaluate(() => {
        const host = document.querySelector('.mm-rend-host[data-mm-state], .mm-rend-host');
        const pre = host.nextElementSibling;
        const button = host.shadowRoot.querySelector("button");
        const before = { label: button.textContent, hidden: pre.hidden };
        button.click();
        return { before, after: { label: button.textContent, hidden: pre.hidden } };
      });
      assert.deepEqual(result.before, { label: "Show source", hidden: true });
      assert.deepEqual(result.after, { label: "Hide source", hidden: false });
    });

    await check("blocks added after load are rendered via MutationObserver", async () => {
      await page.bringToFront();
      await page.evaluate(() => document.getElementById("add").click());
      await waitForRenders(page, 4);
    });

    await check("strict-CSP page renders with styles applied", async () => {
      const strict = await browser.newPage();
      await strict.goto(`${origin}/strict-csp.html`, { waitUntil: "load" });
      await waitForRenders(strict, 1);
      const fill = await strict.evaluate(() => {
        const rect = document.querySelector(".mm-rend-host").shadowRoot.querySelector("rect");
        return getComputedStyle(rect).fill;
      });
      assert.equal(fill, "rgb(236, 236, 255)");
      await strict.close();
    });

    await check("disable stops rendering on new page loads", async () => {
      await options.click(".secondary");
      await options.waitForFunction(() => document.getElementById("sites").children.length === 0, {
        timeout: 15000,
        polling: 250,
      });
      const after = await browser.newPage();
      await after.goto(`${origin}/sample.html`, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 2500));
      const count = await after.$$eval(".mm-rend-host", (els) => els.length);
      assert.equal(count, 0);
      await after.close();
    });

    await check("no network requests left the local fixture origin", async () => {
      const external = networkUrls.filter(
        (url) => !url.startsWith(origin) && !url.startsWith("chrome-extension://") && !url.startsWith("data:") && url !== "about:blank" && !url.startsWith("chrome://"),
      );
      assert.deepEqual(external, []);
    });
  } finally {
    console.log(results.join("\n"));
    await browser.close();
    server.close();
    await rm(extensionDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
