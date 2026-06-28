// Context captured from the active tab when the user clicks the extension icon.
export interface PageContext {
  hostname: string;
  selection: string;
  capturedAt: number;
}

// chrome.storage.session key under which the latest captured context is stored.
export const CONTEXT_STORAGE_KEY = "dealecho:lastContext";
