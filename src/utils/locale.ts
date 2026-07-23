/**
 * Coarse, privacy-friendly geo signal read from the browser: IANA timezone
 * (reliable region indicator) plus the BCP-47 language tag (country hint).
 * No IP, no external lookup. Sent with recordAcquisition on signup and stored
 * once on the user doc; the server derives country from the language tag.
 */
export interface LocaleSignal {
  timeZone: string;
  language: string;
}

export function getLocale(): LocaleSignal | null {
  try {
    const timeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const language = navigator.language || "";
    if (!timeZone && !language) return null;
    return { timeZone, language };
  } catch {
    return null;
  }
}
