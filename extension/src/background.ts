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

/**
 * Persist the captured context. Never clobbers with an empty hostname (e.g. chrome://
 * pages or an unreadable tab), and skips redundant writes unless forced.
 */
async function storeContext(hostname: string, selection: string, force = false): Promise<void> {
  if (!hostname && !selection) {
    console.debug("[Dealecho] storeContext skipped — nothing to look up");
    return;
  }
  if (!force) {
    const existing = (await chrome.storage.session.get(CONTEXT_STORAGE_KEY))[CONTEXT_STORAGE_KEY] as
      | PageContext
      | undefined;
    if (existing && existing.hostname === hostname && existing.selection === selection) {
      console.debug("[Dealecho] storeContext skipped — unchanged", hostname);
      return;
    }
  }
  const context: PageContext = { hostname, selection, capturedAt: Date.now() };
  await chrome.storage.session.set({ [CONTEXT_STORAGE_KEY]: context });
  console.debug("[Dealecho] context set →", hostname, selection ? `(sel: ${selection})` : "");
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

// Auto-refresh as the user browses. Use the tab the event provides — a service
// worker has no "current window", so querying for it is unreliable.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    console.debug("[Dealecho] onActivated", tabId, "url:", tab.url);
    await storeContext(hostnameFromUrl(tab.url), "");
  } catch (err) {
    console.debug("[Dealecho] onActivated failed", err);
  }
});
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === "complete" || changeInfo.url)) {
    console.debug("[Dealecho] onUpdated", _tabId, "url:", tab.url, "status:", changeInfo.status);
    void storeContext(hostnameFromUrl(tab.url), "");
  }
});

// Manual refresh button: re-read the focused window's active tab and force a lookup.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "dealecho:refresh") return;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await storeContext(hostnameFromUrl(tab?.url), "", true);
  })();
});

// Right-click → "Search Dealecho for '<selection>'": the reliable way to look up
// highlighted text on any page (selection comes straight from the menu event).
const SEARCH_MENU_ID = "dealecho-search-selection";
chrome.runtime.onInstalled.addListener(() => {
  // removeAll first — re-running create with the same id throws "duplicate id".
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SEARCH_MENU_ID,
      title: 'Search Dealecho for "%s"',
      contexts: ["selection"],
    });
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== SEARCH_MENU_ID || !tab?.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
  await storeContext(hostnameFromUrl(tab.url), (info.selectionText || "").trim(), true);
});
