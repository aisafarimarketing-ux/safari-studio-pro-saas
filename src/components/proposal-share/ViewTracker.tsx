"use client";

import { useEffect } from "react";

// Anonymous view tracker. Mounts on /p/[id] and:
//   1. Fires an "open" event on first mount (per-session).
//   2. Watches section anchors (#section-xxx, #day-xxx) via
//      IntersectionObserver and records a "section" event with the
//      dwell time each time one leaves the viewport.
//   3. Fires a "close" event on page unload with any remaining dwell.
//
// sessionId lives in sessionStorage so a reload is the same session;
// a new tab is a new session.

const SESSION_KEY = "ss-view-session";

export function ViewTracker({ proposalId }: { proposalId: string }) {
  useEffect(() => {
    const sessionId = ensureSessionId();
    let currentSectionId: string | null = null;
    let sectionEnteredAt: number | null = null;
    let unloaded = false;

    // ── Fire "open" once per session
    post(proposalId, { sessionId, kind: "open" });

    // ── IntersectionObserver for section dwell
    const observer = new IntersectionObserver(
      (entries) => {
        // Track the section with the largest visible ratio as "current".
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = visible.target.id;
        if (id === currentSectionId) return;
        // Flush dwell of the previous section.
        flushCurrent();
        currentSectionId = id;
        sectionEnteredAt = Date.now();
      },
      { threshold: [0.2, 0.5, 0.8] },
    );

    // Attach to any DOM node whose id starts with "section-" or "day-".
    const elements = document.querySelectorAll<HTMLElement>('[id^="section-"], [id^="day-"]');
    elements.forEach((el) => observer.observe(el));

    function flushCurrent() {
      if (currentSectionId && sectionEnteredAt != null) {
        const dwellSeconds = Math.max(1, Math.round((Date.now() - sectionEnteredAt) / 1000));
        if (dwellSeconds >= 2) {
          post(proposalId, {
            sessionId,
            kind: "section",
            sectionId: currentSectionId,
            dwellSeconds,
          });
        }
      }
    }

    function onUnload() {
      if (unloaded) return;
      unloaded = true;
      flushCurrent();
      // navigator.sendBeacon is the reliable unload hook — XHR/fetch are
      // often cancelled when the page tears down.
      const payload: Record<string, unknown> = { sessionId, kind: "close" };
      if (currentSectionId && sectionEnteredAt != null) {
        payload.sectionId = currentSectionId;
        payload.dwellSeconds = Math.round((Date.now() - sectionEnteredAt) / 1000);
      }
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon?.(`/api/public/proposals/${proposalId}/track`, blob);
    }

    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onUnload();
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [proposalId]);

  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Exported so other client-facing flows (ReservationDialog, etc.) can
// resolve the same session id and tie their events back to the same
// engagement-tracker session.
export function ensureSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function post(proposalId: string, body: Record<string, unknown>) {
  void fetch(`/api/public/proposals/${proposalId}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => { /* silent — tracker should never impact the proposal view */ });
}
