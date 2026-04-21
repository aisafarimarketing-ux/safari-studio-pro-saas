"use client";

import { useEffect, useRef } from "react";

// Client heartbeat — POSTs to /api/presence every HEARTBEAT_MS while the
// tab is visible so the admin Team page sees the user as "online".
//
// currentView/currentAction are free-form strings the calling page supplies
// to describe what the user is looking at ("request:abc123", "library",
// "editing quote"). The hook only sends changes and a periodic tick — we
// don't spam the endpoint when the user is idle on one screen.
//
// Also fires a final beat with action="signing-out" on window unload so
// the team view flips them to "offline" without waiting for the 2min
// online window to expire. Falls back to fetch with keepalive because
// navigator.sendBeacon only accepts form data / blobs, not JSON cleanly.

const HEARTBEAT_MS = 30_000;

export function useHeartbeat(state: { currentView?: string | null; currentAction?: string | null }): void {
  const { currentView, currentAction } = state;
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    // Both null means "we're not signed in / not on a tracked surface" —
    // don't bother pinging. The PresenceProvider uses this to pause the
    // heartbeat on the marketing page.
    if (!currentView && !currentAction) return;

    let cancelled = false;

    const send = (payload: { currentView?: string | null; currentAction?: string | null }) => {
      if (cancelled) return;
      const body = JSON.stringify(payload);
      lastSentRef.current = body;
      // keepalive so an in-flight heartbeat can finish even if the tab is
      // closing. Small payload so the 64KB keepalive budget is plenty.
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // ignore — heartbeat failures are non-fatal. Admin page shows a
        // slightly stale "last active" timestamp until the next tick.
      });
    };

    // Immediate beat on mount / state change.
    send({ currentView, currentAction });

    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return; // don't tick hidden tabs
      send({ currentView, currentAction });
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") send({ currentView, currentAction });
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onUnload = () => send({ currentView: null, currentAction: "signing-out" });
    window.addEventListener("pagehide", onUnload);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [currentView, currentAction]);
}
