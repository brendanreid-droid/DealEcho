import React, { createContext, useContext, useState, useCallback } from "react";
import Icon from "./Icon";

/**
 * Toast system — replaces raw alert() calls (e.g. the "Failed to save review"
 * alert in useReviews) with in-app, non-blocking notifications styled to
 * Direction B.
 *
 * SETUP:
 * 1. Wrap your app in <ToastProvider> (in App.tsx, just inside <BrowserRouter>):
 *      <BrowserRouter>
 *        <ToastProvider>
 *          ...everything...
 *        </ToastProvider>
 *      </BrowserRouter>
 *
 * 2. Anywhere in a component:
 *      const { toast } = useToast();
 *      toast.error("Failed to save review. Please try again.");
 *      toast.success("Review submitted for moderation.");
 *
 * 3. For non-component code (like the useReviews hook), the cleanest path is to
 *    return the error to the calling component and toast there, rather than
 *    toasting from inside the hook. See PHASE5-README for the useReviews tweak.
 */

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<{ toast: ToastApi } | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, type, message }]);
    // Auto-dismiss after 4.5s
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = (id: number) =>
    setItems((prev) => prev.filter((t) => t.id !== id));

  const toast: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  const styles: Record<ToastType, string> = {
    success: "bg-signal-healthy text-white",
    error: "bg-signal-risk text-white",
    info: "bg-navy text-white",
  };
  const icons: Record<ToastType, string> = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    info: "fa-info-circle",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[2000] flex flex-col gap-2.5 max-w-sm">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex items-center gap-3 px-4 py-3.5 rounded-card shadow-lift font-semibold text-sm ${styles[t.type]}`}
          >
            <Icon name={icons[t.type]} size={16} />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="hover:opacity-60"
              aria-label="Dismiss"
            >
              <Icon name="fa-times" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
