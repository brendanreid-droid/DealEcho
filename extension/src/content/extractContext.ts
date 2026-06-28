import { PageContext } from "../shared/messages";

/** Pure extraction of company context from a window. `now` is injected for testability. */
export function extractContext(win: Window, now: number): PageContext {
  const hostname = win.location?.hostname ?? "";
  const selection = (win.getSelection()?.toString() ?? "").trim();
  return { hostname, selection, capturedAt: now };
}
