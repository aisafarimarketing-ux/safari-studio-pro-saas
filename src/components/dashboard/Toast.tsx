"use client";

import { useEffect, useState } from "react";

// Lightweight toast — single instance at the bottom-right of the
// dashboard. Listens for "ss:toast" CustomEvents so any component can
// fire one without prop-threading. Optional 5-second undo button calls
// the supplied onUndo callback when clicked. Auto-dismisses on a
// 5-second timer; closes early if the user clicks ✕ or Undo.

export type ToastDetail = {
  /** One-line message shown in the toast. */
  message: string;
  /** Optional context line (smaller, dimmer). */
  hint?: string;
  /** When supplied, an "Undo" button appears for 5s before auto-dismiss. */
  onUndo?: () => void;
  /** Override auto-dismiss in ms. Defaults to 5000. */
  durationMs?: number;
};

export function fireToast(detail: ToastDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>("ss:toast", { detail }));
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastDetail | null>(null);
  // Bumping `seq` resets the auto-dismiss timer when a new toast lands
  // while one is still visible — without it, the old timeout would
  // close the new toast prematurely.
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      setToast(detail);
      setSeq((n) => n + 1);
    };
    window.addEventListener("ss:toast", onToast);
    return () => window.removeEventListener("ss:toast", onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.durationMs ?? 5000;
    const handle = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(handle);
  }, [toast, seq]);

  if (!toast) return null;

  const handleUndo = () => {
    toast.onUndo?.();
    setToast(null);
  };

  return (
    <div
      className="fixed bottom-5 right-5 z-[1100] max-w-[420px]"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl"
        style={{
          background: "#0f1f17",
          color: "#f4ede0",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold leading-snug">
            {toast.message}
          </div>
          {toast.hint && (
            <div className="text-[11.5px] mt-0.5" style={{ color: "rgba(244,237,224,0.75)" }}>
              {toast.hint}
            </div>
          )}
        </div>
        {toast.onUndo && (
          <button
            type="button"
            onClick={handleUndo}
            className="text-[12px] font-semibold px-2.5 h-7 rounded-md transition active:scale-95"
            style={{ background: "rgba(255,255,255,0.10)", color: "#f4ede0" }}
          >
            Undo
          </button>
        )}
        <button
          type="button"
          onClick={() => setToast(null)}
          className="text-[16px] leading-none transition hover:opacity-80"
          style={{ color: "rgba(244,237,224,0.7)" }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
