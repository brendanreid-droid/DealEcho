import { extractContext } from "./extractContext";
import { PageContext } from "../shared/messages";

// Returned to background via executeScript's result.
export function capture(): PageContext {
  return extractContext(window, Date.now());
}
