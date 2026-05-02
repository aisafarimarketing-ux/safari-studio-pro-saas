"use client";

import { useEffect, useState } from "react";

// AuthExpiredBanner — listens for the global "safari-studio:auth-expired"
// CustomEvent and pops a persistent top banner when the operator's
// Clerk session has expired. Without it, image uploads + auto-saves
// silently 401 and the editor LOOKS fine while every change is
// disappearing into the void. Operators flagged "images missing in
// preview / webview" repeatedly — root cause was a session that
// expired while the tab stayed open.
//
// Why a banner instead of an auto-redirect:
//   Earlier we tried auto-redirecting on the first 401. That yanked
//   the operator out mid-edit, and the sign-in page (sometimes seeing
//   them as still signed-in via a refreshed cookie) bounced them to
//   /dashboard — so they lost work AND ended up at the wrong screen.
//   The banner gives the operator a chance to copy out anything they
//   absolutely need before re-authenticating, with a one-click
//   "Sign in" button that opens in a new tab so the editor stays put.

export function AuthExpiredBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("safari-studio:auth-expired", handler);
    return () => window.removeEventListener("safari-studio:auth-expired", handler);
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
