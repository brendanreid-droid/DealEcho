# Extension Plan 2A — Scaffold + Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the browser extension skeleton — a Vite + crxjs MV3 project with a background service worker, an on-demand content script, and a Side Panel that displays the company context (domain + highlighted text) captured from the active tab when the user clicks the extension icon.

**Architecture:** A new top-level `extension/` workspace (its own package.json, isolated from the web app's Vite build). Clicking the toolbar icon opens the Side Panel and injects a content script via `activeTab`/`scripting`; the content script extracts `{ hostname, selection }` using a pure, unit-tested function and returns it; the background worker stashes it and the React Side Panel reads and renders it. No auth, no network, no Firebase yet — this plan proves the plumbing end-to-end.

**Tech Stack:** Vite 6, @crxjs/vite-plugin (MV3 manifest + HMR), React 19, TypeScript, vitest + @testing-library (matching the web app), Chrome Side Panel API.

**Depends on:** nothing (the backend endpoint from Plan 1 is not called here). Subsequent plans 2B/2C/2D build on this.

---

## File Structure

```
extension/
  package.json            # isolated deps + scripts
  vite.config.ts          # crxjs plugin wiring
  manifest.config.ts      # MV3 manifest (typed, via crxjs defineManifest)
  tsconfig.json
  vitest.config.ts
  index.html              # side panel entry (Vite root html)
  src/
    background.ts         # service worker: icon click → open panel + capture context
    content/
      extractContext.ts   # PURE: read hostname + selection from a Document/Window
      extractContext.test.ts
      content.ts          # injected script: calls extractContext, returns result
    sidepanel/
      main.tsx            # React root
      App.tsx             # renders captured context (loading / context / empty states)
    shared/
      messages.ts         # typed message + storage key constants
  public/
    icons/icon-128.png    # toolbar icon (placeholder ok)
```

---

### Task 1: Scaffold the `extension/` workspace

**Files:**
- Create: `extension/package.json`, `extension/tsconfig.json`, `extension/vite.config.ts`, `extension/manifest.config.ts`, `extension/vitest.config.ts`, `extension/index.html`

- [ ] **Step 1: Create `extension/package.json`**

```json
{
  "name": "dealecho-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "@testing-library/react": "^16.3.2",
    "@types/chrome": "^0.0.287",
    "@types/react": "^19.2.15",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^29.1.1",
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Create `extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "manifest.config.ts", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `extension/manifest.config.ts`**

```ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "DealEcho — Company Reviews",
  version: "0.1.0",
  description: "See DealEcho deal intelligence for any company, on prospect sites or in your CRM.",
  action: { default_title: "DealEcho" },
  background: { service_worker: "src/background.ts", type: "module" },
  permissions: ["activeTab", "scripting", "storage", "sidePanel"],
  side_panel: { default_path: "index.html" },
  icons: { "128": "public/icons/icon-128.png" },
});
```

- [ ] **Step 4: Create `extension/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
});
```

- [ ] **Step 5: Create `extension/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
  },
});
```

- [ ] **Step 6: Create `extension/index.html`** (Side Panel entry)

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DealEcho</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/sidepanel/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Install dependencies**

Run: `npm install --prefix extension`
Expected: dependencies install with no errors. (Note: this repo root is NOT an npm workspace; always use `--prefix extension`.)

- [ ] **Step 8: Commit**

```bash
git add extension/package.json extension/tsconfig.json extension/vite.config.ts extension/manifest.config.ts extension/vitest.config.ts extension/index.html extension/package-lock.json
git commit -m "chore(extension): scaffold Vite + crxjs MV3 project"
```

---

### Task 2: Shared message/storage contract

**Files:**
- Create: `extension/src/shared/messages.ts`

- [ ] **Step 1: Create the contract**

```ts
// Context captured from the active tab when the user clicks the extension icon.
export interface PageContext {
  hostname: string;
  selection: string;
  capturedAt: number;
}

// chrome.storage.session key under which the latest captured context is stored.
export const CONTEXT_STORAGE_KEY = "dealecho:lastContext";
```

- [ ] **Step 2: Commit**

```bash
git add extension/src/shared/messages.ts
git commit -m "feat(extension): shared page-context contract"
```

---

### Task 3: Pure context extraction (TDD)

**Files:**
- Create: `extension/src/content/extractContext.ts`
- Test: `extension/src/content/extractContext.test.ts`

Test command: `npm --prefix extension test -- extractContext`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { extractContext } from "./extractContext";

function fakeWin(hostname: string, selectionText: string): Window {
  return {
    location: { hostname } as Location,
    getSelection: () => ({ toString: () => selectionText }) as Selection,
  } as unknown as Window;
}

describe("extractContext", () => {
  it("captures hostname and trimmed selection", () => {
    const ctx = extractContext(fakeWin("www.acme.com", "  Datadog Inc  "), 1000);
    expect(ctx.hostname).toBe("www.acme.com");
    expect(ctx.selection).toBe("Datadog Inc");
    expect(ctx.capturedAt).toBe(1000);
  });

  it("returns empty selection when nothing is highlighted", () => {
    const ctx = extractContext(fakeWin("acme.com", ""), 5);
    expect(ctx.selection).toBe("");
  });

  it("tolerates a null selection", () => {
    const win = { location: { hostname: "acme.com" }, getSelection: () => null } as unknown as Window;
    const ctx = extractContext(win, 5);
    expect(ctx.selection).toBe("");
    expect(ctx.hostname).toBe("acme.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix extension test -- extractContext`
Expected: FAIL — cannot find module `./extractContext`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { PageContext } from "../shared/messages";

/** Pure extraction of company context from a window. `now` is injected for testability. */
export function extractContext(win: Window, now: number): PageContext {
  const hostname = win.location?.hostname ?? "";
  const selection = (win.getSelection()?.toString() ?? "").trim();
  return { hostname, selection, capturedAt: now };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix extension test -- extractContext`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add extension/src/content/extractContext.ts extension/src/content/extractContext.test.ts
git commit -m "feat(extension): pure page-context extraction"
```

---

### Task 4: Injected content script

**Files:**
- Create: `extension/src/content/content.ts`

This is the script injected into the active tab on icon click. It calls the pure extractor and returns the result to the caller (`chrome.scripting.executeScript` resolves with the function's return value).

- [ ] **Step 1: Implement**

```ts
import { extractContext } from "./extractContext";
import { PageContext } from "../shared/messages";

// Returned to background via executeScript's result.
export function capture(): PageContext {
  return extractContext(window, Date.now());
}
```

> Note: `chrome.scripting.executeScript({ func: capture })` serializes and runs `capture` in the page. Because crxjs bundles imports, the background will instead inject the built content script file and message it (see Task 5). Keeping `capture` exported makes it directly callable.

- [ ] **Step 2: Build to confirm it compiles**

Run: `npm run build --prefix extension`
Expected: build succeeds (tsc + vite). If crxjs complains about an unreferenced content script, that's resolved in Task 5 where the background injects it.

- [ ] **Step 3: Commit**

```bash
git add extension/src/content/content.ts
git commit -m "feat(extension): content-script capture entrypoint"
```

---

### Task 5: Background service worker

**Files:**
- Create: `extension/src/background.ts`

On icon click: open the Side Panel for the tab, run the capture function in the active tab via `chrome.scripting.executeScript`, and store the result in `chrome.storage.session` for the panel to read.

- [ ] **Step 1: Implement**

```ts
import { extractContext } from "./content/extractContext";
import { CONTEXT_STORAGE_KEY, PageContext } from "./shared/messages";

// Runs IN the page (must be self-contained — executeScript serializes the function).
function capturePageContext(): { hostname: string; selection: string } {
  return {
    hostname: window.location?.hostname ?? "",
    selection: (window.getSelection()?.toString() ?? "").trim(),
  };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  // Open the side panel for this tab.
  await chrome.sidePanel.open({ tabId: tab.id });

  // Capture context from the page.
  let captured = { hostname: "", selection: "" };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: capturePageContext,
    });
    if (result?.result) captured = result.result;
  } catch (err) {
    console.error("DealEcho: context capture failed", err);
  }

  const context: PageContext = { ...captured, capturedAt: Date.now() };
  await chrome.storage.session.set({ [CONTEXT_STORAGE_KEY]: context });
});
```

> `extractContext` is imported to keep one source of truth in mind, but `capturePageContext` is intentionally inlined and self-contained because `executeScript({func})` serializes the function and cannot reference bundled imports. The pure `extractContext` (Task 3) remains the unit-tested reference for the same logic.

- [ ] **Step 2: Remove the now-unused import to keep the build clean**

Edit `extension/src/background.ts`: delete the `extractContext` import line (it is not used — `capturePageContext` is inlined). Keep the `CONTEXT_STORAGE_KEY, PageContext` import.

- [ ] **Step 3: Build**

Run: `npm run build --prefix extension`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add extension/src/background.ts
git commit -m "feat(extension): background worker captures context + opens side panel"
```

---

### Task 6: Side Panel React UI

**Files:**
- Create: `extension/src/sidepanel/main.tsx`
- Create: `extension/src/sidepanel/App.tsx`

Reads the captured context from `chrome.storage.session`, subscribes to changes, and renders it. Three states: loading, context present, no context yet.

- [ ] **Step 1: Create `extension/src/sidepanel/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Create `extension/src/sidepanel/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { CONTEXT_STORAGE_KEY, PageContext } from "../shared/messages";

export function App() {
  const [context, setContext] = useState<PageContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.session.get(CONTEXT_STORAGE_KEY).then((data) => {
      setContext(data[CONTEXT_STORAGE_KEY] ?? null);
      setLoading(false);
    });

    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "session" && changes[CONTEXT_STORAGE_KEY]) {
        setContext(changes[CONTEXT_STORAGE_KEY].newValue ?? null);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, minWidth: 280 }}>
      <h1 style={{ fontSize: 16, margin: "0 0 12px" }}>DealEcho</h1>
      {loading && <p>Loading…</p>}
      {!loading && !context && <p>Click the DealEcho icon on a company page to begin.</p>}
      {!loading && context && (
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          <p><strong>Site:</strong> {context.hostname || "—"}</p>
          <p><strong>Highlighted:</strong> {context.selection || "(nothing selected)"}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build --prefix extension`
Expected: builds with no errors; `extension/dist/` contains the bundled extension.

- [ ] **Step 4: Commit**

```bash
git add extension/src/sidepanel/main.tsx extension/src/sidepanel/App.tsx
git commit -m "feat(extension): side panel renders captured page context"
```

---

### Task 7: Toolbar icon + .gitignore

**Files:**
- Create: `extension/public/icons/icon-128.png`
- Create: `extension/.gitignore`

- [ ] **Step 1: Add a 128×128 placeholder icon**

Copy an existing logo if present, else generate a solid placeholder:

Run: `ls public/*.png public/icons/*.png 2>/dev/null` to find an existing logo. If one exists, copy it:
`cp <found-logo>.png extension/public/icons/icon-128.png`

If none exists, generate one (requires ImageMagick; if unavailable, create any 128×128 PNG by another means):
`mkdir -p extension/public/icons && magick -size 128x128 xc:'#4f46e5' extension/public/icons/icon-128.png`

Verify the file exists and is a PNG: `file extension/public/icons/icon-128.png` → should report "PNG image data, 128 x 128".

- [ ] **Step 2: Create `extension/.gitignore`**

```
node_modules
dist
*.log
```

- [ ] **Step 3: Commit**

```bash
git add extension/public/icons/icon-128.png extension/.gitignore
git commit -m "chore(extension): toolbar icon + gitignore"
```

---

### Task 8: Manual end-to-end verification (load unpacked)

This cannot be automated — it requires loading the extension in Chrome.

- [ ] **Step 1: Build**

Run: `npm run build --prefix extension`
Expected: `extension/dist/` is produced.

- [ ] **Step 2: Load unpacked**

In Chrome: `chrome://extensions` → enable Developer Mode → "Load unpacked" → select `extension/dist`.
Expected: "DealEcho — Company Reviews" appears with the icon, no errors on the card.

- [ ] **Step 3: Exercise the flow**

1. Navigate to any site, e.g. `https://www.datadoghq.com`.
2. Click the DealEcho toolbar icon.
   - Expected: the Side Panel opens and shows **Site: www.datadoghq.com**, Highlighted: (nothing selected).
3. Highlight some text (e.g. "Datadog") on the page, click the icon again.
   - Expected: Side Panel shows **Highlighted: Datadog**.
4. Open `chrome://extensions` → DealEcho → "Service worker" link → Console: confirm no errors (a failed capture logs "DealEcho: context capture failed").

- [ ] **Step 4: Record the result**

If all three states render correctly, this plan is complete. If capture fails on some sites (e.g. `chrome://` pages or the Web Store — `activeTab`/scripting is blocked there by design), that is expected; verify on a normal site.

---

## Self-Review

**Spec coverage (vs `2026-06-28-browser-extension-design.md`, the parts in 2A scope):**
- Extension scaffold (Vite/React/TS, MV3) → Task 1. ✅
- Side Panel UI surface → Tasks 1, 6. ✅
- activeTab click trigger reading domain + highlighted text → Tasks 4, 5. ✅
- On-demand content script (no broad host permissions) → Task 5 (`activeTab` + `scripting`, no `host_permissions`). ✅
- Auth, Firebase, lookup endpoint, summary/persona/reviews, store packaging → **out of 2A scope; covered by Plans 2B/2C/2D.** ✅

**Placeholders:** none — all code complete. The icon step has an explicit fallback if ImageMagick is absent.

**Type consistency:** `PageContext { hostname, selection, capturedAt }` and `CONTEXT_STORAGE_KEY` from `shared/messages.ts` are used identically in `background.ts`, `App.tsx`, and `extractContext.ts`. The inlined `capturePageContext` in the background intentionally returns only `{hostname, selection}` (capturedAt is added by the worker) — noted in-code.

**Note on `executeScript` + bundling:** the background inlines `capturePageContext` because `executeScript({func})` serializes the function and cannot reference bundled imports; the pure `extractContext` remains the unit-tested reference for identical logic. This duplication is deliberate and minimal (3 lines).
