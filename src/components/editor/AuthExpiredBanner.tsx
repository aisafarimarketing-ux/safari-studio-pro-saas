"use client";

import { useEffect, useRef, useState } from "react";

// AuthExpiredBanner — listens for the global "safari-studio:auth-expired"
// CustomEvent and pops a persistent top banner when the operator's
// Clerk session has expired.
//
// Behavior:
//   1) While the session is HEALTHY, pings /api/session-ping every
//      60s (and on tab refocus). Catches expiry proactively.
//   2) Once expired, STOPS pinging — otherwise the console floods
//      with 401s every minute, drowning out real errors. Resumes
//      pinging only when the operator dismisses the banner or comes
//      back from a refocus that returns 200 (they signed in elsewhere).
//   3) On tab refocus while the banner is showing, pings ONCE. A 200
//      response means the operator signed in — we auto-reload to
//      pick up fresh data. A 401 keeps the banner up.
//
// Earlier the keep-alive interval kept firing after the banner went
// up — operator's console flooded with /api/session-ping 401s,
// confusing the diagnostic picture and making it look like a
// general bug rather than a single expired-session symptom.

const KEEPALIVE_INTERVAL_MS = 60 * 1000;

export function AuthExpiredBanner() {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("safari-studio:auth-expired", handler);
    return () => window.removeEventListener("safari-studio:auth-expired", handler);
  }, []);

  // Session keep-alive — only runs while the banner is CLOSED. Once
  // we know the session is dead we stop pinging so we don't flood
  // the console with 401s every minute. The banner-dismiss handler
  // (and tab-refocus auto-recovery) re-arms us.
  useEffect(() => {
    let cancelled = false;

    const ping = async (): Promise<number | null> => {
      if (cancelled) return null;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return null;
      try {
        const res = await fetch("/api/session-ping", { cache: "no-store" });
        return res.status;
      } catch {
        return null;
      }
    };

    const tickWhileHealthy = async () => {
      if (openRef.current) return;
      const status = await ping();
      if (status === 401) {
        window.dispatchEvent(new CustomEvent("safari-studio:auth-expired"));
      }
    };

    const timer = setInterval(tickWhileHealthy, KEEPALIVE_INTERVAL_MS);

    // On tab refocus:
    //   • If banner is open, ping once. 200 = operator signed in
    //     elsewhere; auto-reload so the fresh session + data take
    //     effect. 401 = still expired; keep banner up.
    //   • If banner is closed, do a normal health check.
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const status = await ping();
      if (status === 200 && openRef.current) {
        // Session restored — reload to pick up latest data + clear
        // banner. Brief delay so any in-flight fetches settle first.
        setTimeout(() => window.location.reload(), 200);
        return;
      }
      if (status === 401 && !openRef.current) {
        window.dispatchEvent(new CustomEvent("safari-studio:auth-expired"));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100000,
        background: "#b34334",
        color: "white",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "inherit",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>⚠</span>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
        <strong>Your session has expired.</strong> Image uploads and
        auto-saves are failing — recent changes have NOT been saved. Sign
        in again to keep working.
      </div>
      <a
        href="/sign-in"
        target="_blank"
        rel="noopener"
        style={{
          background: "white",
          color: "#b34334",
          padding: "6px 14px",
          borderRadius: 6,
          fontSize: 12.5,
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Sign in →
      </a>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: "transparent",
          color: "white",
          border: "1px solid rgba(255,255,255,0.5)",
          padding: "6px 12px",
          borderRadius: 6,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{
          background: "transparent",
          color: "white",
          border: "none",
          padding: "4px 8px",
          fontSize: 18,
          fontWeight: 600,
          cursor: "pointer",
          opacity: 0.7,
        }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
