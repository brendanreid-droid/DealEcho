import { useEffect, useState } from "react";
import { CONTEXT_STORAGE_KEY, PageContext } from "../shared/messages";

export function App() {
  const [context, setContext] = useState<PageContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.session.get(CONTEXT_STORAGE_KEY).then((data) => {
      setContext((data[CONTEXT_STORAGE_KEY] as PageContext | undefined) ?? null);
      setLoading(false);
    });

    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "session" && changes[CONTEXT_STORAGE_KEY]) {
        setContext((changes[CONTEXT_STORAGE_KEY].newValue as PageContext | undefined) ?? null);
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
