import { CONTEXT_STORAGE_KEY, PageContext } from "./shared/messages";

// Runs IN the page (must be self-contained — executeScript serializes the function).
function capturePageContext(): { hostname: string; selection: string } {
  return {
    hostname: window.location?.hostname ?? "",
    selection: (window.getSelection()?.toString() ?? "").trim(),
  };
}

function hostnameFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Persist the captured context. Skips redundant writes unless forced. */
async function storeContext(hostname: string, selection: string, force = false): Promise<void> {
  if (!force) {
    const existing = (await chrome.storage.session.get(CONTEXT_STORAGE_KEY))[CONTEXT_STORAGE_KEY] as
      | PageContext
      | undefined;
    if (existing && existing.hostname === hostname && existing.selection === selection) return;
  }
  const context: PageContext = { hostname, selection, capturedAt: Date.now() };
  await chrome.storage.session.set({ [CONTEXT_STORAGE_KEY]: context });
}

/** Read the active tab's URL (no injection — uses the "tabs" permission). Domain only. */
async function captureActiveTabUrl(force = false): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await storeContext(hostnameFromUrl(tab?.url), "", force);
}

// Icon click: open the panel + capture the domain AND any highlighted text
// (page injection requires the activeTab user-gesture grant).
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });

  let captured = { hostname: hostnameFromUrl(tab.url), selection: "" };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: capturePageContext,
    });
    if (result?.result) captured = result.result;
  } catch (err) {
    console.error("Dealecho: context capture failed", err);
  }
  await storeContext(captured.hostname, captured.selection, true);
});

// Auto-refresh as the user browses: switching tabs or navigating updates the domain.
chrome.tabs.onActivated.addListener(() => {
  void captureActiveTabUrl();
});
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === "complete" || changeInfo.url)) {
    void captureActiveTabUrl();
  }
});

// Manual refresh button in the panel forces a re-read of the active tab.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "dealecho:refresh") void captureActiveTabUrl(true);
});
