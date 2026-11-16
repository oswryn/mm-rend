# mm-rend

Mermaid fence renderer for Chromium browsers (Chrome and Edge). It renders fenced
` ```mermaid ` code blocks as diagrams on sites you allow, for example on-premises
Azure DevOps Server, where only the `::: mermaid` container syntax renders natively.

Everything runs locally. Diagrams are drawn with a Mermaid bundle that ships inside
the extension (`vendor/mermaid.min.js`). The extension makes no network requests and
has no remote scripts, analytics, or cloud rendering.

## Install (Chrome or Edge)

The same unpacked folder works in both browsers.

1. Clone or download this repository as a zip (and extract it somewhere).
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the repository root (the folder that contains `manifest.json`).
5. Open the extension's **Details** page and choose **Extension options** to manage allowed sites.

Examples:

| Image 1 | Image 2 | Image 3 |
|---------|---------|---------|
| ![Alt 1](path/to/image1.png) | ![Alt 2](path/to/image2.png) | ![Alt 3](path/to/image3.png) |

<img width="1030" height="525" alt="downloading the repository as a zip" src="https://github.com/user-attachments/assets/dce37f98-bbcd-4de8-a0dd-7f60a985ef3f" />

<img width="335" height="307" alt="enabling developer mode" src="https://github.com/user-attachments/assets/ad978cfd-7549-4f39-a84b-53d678eb0e44" />

<img width="1167" height="212" alt="loading unpacked" src="https://github.com/user-attachments/assets/ad5f6808-5f97-4637-b815-679b2b6106ef" />

<img width="891" height="673" alt="correct folder to open" src="https://github.com/user-attachments/assets/ff9ea85f-03bd-4d32-bbce-0a66a8bb140d" />

Requires Chrome or Edge 116 or newer.

## Enable on your Azure DevOps host

The extension asks for access to each site separately. Nothing runs on a site until you allow it.

1. Open your Azure DevOps page (for example `https://tfs.contoso.local/tfs/DefaultCollection/...`).
2. Click the extension icon and choose **Enable on this site**. This opens the options page with the site filled in.
3. Click **Grant access and enable** and accept the browser prompt.
4. The open tab renders immediately. Future page loads on that site render automatically.

<img width="322" height="295" alt="image" src="https://github.com/user-attachments/assets/d0ac8871-9e64-4181-87ca-f1dab740edb8" />

To stop rendering, use **Disable on this site** in the popup, or **Remove** on the options page. Reload open pages afterwards.

## What gets rendered

- `pre > code.language-mermaid` (and `lang-mermaid`, `hljs` variants), as well as a `pre` with a `mermaid` class.
- Unlabelled code blocks whose first line starts with a Mermaid diagram keyword (`graph`, `flowchart`, `sequenceDiagram`, `classDiagram`, `pie`, and so on).
- Blocks inside a native `.mermaid` container or already rendered by Azure DevOps are left alone.

Each rendered diagram has a **Show source** button that reveals the original fence text.
If a block fails to parse, the source stays visible with a short error message.

## Appearance

Open the options page and use **Diagram appearance**. Changes apply immediately to open pages.

- **Diagram theme**: *Match the page* (default) picks light or dark from the background behind each diagram. You can also force Light, Dark, Neutral or Forest.
- **Card background**: *Transparent* (default) lets the page show through. *Light card* and *Dark card* keep diagrams readable on any page.

Settings are saved with `chrome.storage.sync`, so they follow your browser profile when sync is on.

## Permissions

| Permission | Why |
|---|---|
| `offscreen` | Host the Mermaid renderer in an extension document. |
| `scripting` | Register the content script for sites you allow. |
| `storage` | Remember the list of allowed sites. |
| `activeTab` | Read the URL of the current tab when you open the popup. |
| Optional host access (`http://*/*`, `https://*/*`) | Granted per site, only when you choose to enable it. |

## Architecture

```
page DOM --> content script (detect + Shadow DOM inject)
                  |  runtime message
                  v
          service worker  --> offscreen document --> sandboxed iframe (Mermaid, vendor/mermaid.min.js)
                  ^                                            |
                  +------------------ SVG or error ------------+
```

The sandboxed iframe exists because Mermaid's parsers need `eval`-like APIs, and the
extension-page CSP for Manifest V3 cannot allow them. Sandboxed extension pages can.
The sandbox has no access to Chrome APIs or the page.

## Updating Mermaid

Mermaid is pinned in `package.json`. To refresh the bundle:

```
npm install
npm run vendor
```

`npm run vendor` copies `node_modules/mermaid/dist/mermaid.min.js` into `vendor/` and fails if the
bundle would need to fetch chunks at runtime.

## Icons

The toolbar and options icon is drawn in `icons/icon.svg`. After editing it, regenerate the PNGs with
`CHROME_PATH=/path/to/chrome npm run icons`.

## Development and tests

```
npm install
CHROME_PATH=/path/to/chrome npm test
```

`npm test` builds a temporary copy of the extension, loads it into Chromium with
`puppeteer-core`, serves `fixtures/`, and checks enable/disable, rendering, error handling,
the source toggle, dynamically added blocks, a strict-CSP page, and that no requests leave the
fixture origin. `CHROME_PATH` defaults to `google-chrome`.

The fixture pages can also be opened manually: serve `fixtures/` with any static server, enable
that origin from the options page, and reload.

### Manual check on Azure DevOps

1. Enable your ADO origin (see above) and open a wiki page containing a fenced ` ```mermaid ` block.
2. Confirm the block is replaced by a diagram and **Show source** reveals the original text.
3. Edit a wiki page in the browser and confirm the preview renders the new block.
4. Open DevTools > Network and confirm rendering makes no requests to any host.
