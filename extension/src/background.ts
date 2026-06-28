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

  // Open the side panel for this tab (must happen during the user-gesture click).
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
