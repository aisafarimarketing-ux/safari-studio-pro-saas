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
    let currentSectionType: string | null = null;
    let sectionEnteredAt: number | null = null;
    let unloaded = false;
    // Highest scroll depth observed in this session, 0–100. Posted on
    // flush so Inspector AI can tell "viewed but bounced" (scrollDepthPct
    // < 40) apart from "read deeply" — the existing 40% scrolled flag is
    // boolean and doesn't surface that gap.
    let maxScrollPct = 0;

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
        currentSectionType = sectionTypeOf(visible.target as HTMLElement);
        sectionEnteredAt = Date.now();
      },
      { threshold: [0.2, 0.5, 0.8] },
    );

    // Attach to any DOM node whose id starts with "section-" or "day-".
    const elements = document.querySelectorAll<HTMLElement>('[id^="section-"], [id^="day-"]');
    elements.forEach((el) => observer.observe(el));

    // ── proposal_scrolled — fire once per (proposal, session) when
    //    the viewer crosses 40% of the document height. The threshold
    //    sits past the cover/hero so a casual ~one-screen glance
    //    doesn't get counted as engagement; once a guest scrolls
    //    that far they're meaningfully reading. sessionStorage
    //    marker dedupes across remounts so a long scroll session or
    //    a route flip can't re-fire.
    const SCROLL_THRESHOLD = 0.4;
    let scrollFired = readOnceMarker(scrolledKey(proposalId, sessionId));
    const onScroll = () => {
      // Always update maxScrollPct (cheap), even after the 40% boolean
      // has fired — Inspector AI cares about how *far* a viewer got, not
      // just whether they crossed the threshold.
      const scrolled = window.scrollY || document.documentElement.scrollTop;
      const total = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1,
      );
      const pct = Math.max(0, Math.min(100, Math.round((scrolled / total) * 100)));
      if (pct > maxScrollPct) maxScrollPct = pct;
      if (!scrollFired && pct >= SCROLL_THRESHOLD * 100) {
        scrollFired = true;
        writeOnceMarker(scrolledKey(proposalId, sessionId));
        post(proposalId, { sessionId, kind: "proposal_scrolled" });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── price_viewed — IntersectionObserver on any node carrying
    //    data-section-type="pricing". Fires once per (proposal,
    //    session) the first time at least 30% of the pricing section
    //    becomes visible. Disconnects after firing so a scroll back
    //    over pricing doesn't ping the network again.
    let priceFired = readOnceMarker(priceKey(proposalId, sessionId));
    const priceObserver = new IntersectionObserver(
      (entries) => {
        if (priceFired) return;
        const visible = entries.find((e) => e.isIntersecting && e.intersectionRatio >= 0.3);
        if (!visible) return;
        priceFired = true;
        writeOnceMarker(priceKey(proposalId, sessionId));
        post(proposalId, {
          sessionId,
          kind: "price_viewed",
          metadata: { section: "pricing" },
        });
        priceObserver.disconnect();
      },
      { threshold: [0.3, 0.5] },
    );
    if (!priceFired) {
      document
        .querySelectorAll<HTMLElement>('[data-section-type="pricing"]')
        .forEach((el) => priceObserver.observe(el));
    }

    // ── itinerary_clicked — delegated click on the document, walking
    //    up to the nearest [data-section-type] root that counts as
    //    "itinerary content" (dayJourney / itineraryTable / map).
    //    Fires once per (proposal, session). Metadata captures the
    //    section type, day number when present, and destination
    //    when present so the dashboard activity feed can render
    //    "Day 3 — Masai Mara" instead of a bare event row.
    let itineraryFired = readOnceMarker(itineraryKey(proposalId, sessionId));
    const ITINERARY_TYPES = new Set(["dayJourney", "itineraryTable", "map"]);
    const onItineraryClick = (e: MouseEvent) => {
      if (itineraryFired) return;
      const path = e.composedPath?.() ?? [];
      // Walk the composed path so a click inside a deeply-nested
      // element still finds the section root. composedPath is well-
      // supported in modern browsers; fall back to event.target +
      // closest() when it's missing (older Safari).
      let root: HTMLElement | null = null;
      for (const node of path) {
        if (node instanceof HTMLElement && node.dataset.sectionType && ITINERARY_TYPES.has(node.dataset.sectionType)) {
          root = node;
          break;
        }
      }
      if (!root && e.target instanceof HTMLElement) {
        root = e.target.closest<HTMLElement>(
          '[data-section-type="dayJourney"], [data-section-type="itineraryTable"], [data-section-type="map"]',
        );
      }
      if (!root) return;
      itineraryFired = true;
      writeOnceMarker(itineraryKey(proposalId, sessionId));
      const metadata: Record<string, unknown> = {
        section: root.dataset.sectionType ?? null,
      };
      const dayNumber = root.dataset.dayNumber ?? root.closest<HTMLElement>("[data-day-number]")?.dataset.dayNumber;
      if (dayNumber) metadata.dayNumber = Number(dayNumber);
      const destination =
        root.dataset.destination ??
        root.closest<HTMLElement>("[data-destination]")?.dataset.destination;
      if (destination) metadata.destination = destination;
      post(proposalId, {
        sessionId,
        kind: "itinerary_clicked",
        metadata,
      });
      document.removeEventListener("click", onItineraryClick);
    };
    if (!itineraryFired) document.addEventListener("click", onItineraryClick);

    function flushCurrent() {
      if (currentSectionId && sectionEnteredAt != null) {
        const dwellSeconds = Math.max(1, Math.round((Date.now() - sectionEnteredAt) / 1000));
        if (dwellSeconds >= 2) {
          post(proposalId, {
            sessionId,
            kind: "section",
            sectionId: currentSectionId,
            sectionType: currentSectionType,
            dwellSeconds,
            scrollDepthPct: maxScrollPct,
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
      const payload: Record<string, unknown> = {
        sessionId,
        kind: "close",
        scrollDepthPct: maxScrollPct,
      };
      if (currentSectionId && sectionEnteredAt != null) {
        payload.sectionId = currentSectionId;
        if (currentSectionType) payload.sectionType = currentSectionType;
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
      priceObserver.disconnect();
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onItineraryClick);
    };
  }, [proposalId]);

  return null;
}

// Once-per-(proposal, session) markers — keyed by the same
// sessionStorage that drives ensureSessionId, so a reload sees the
// same marker and a re-mount of ViewTracker (route change, theme
// flip) doesn't re-fire any of the funnel events. Failures fall back
// to "fire every time" — better to over-count than silently drop.
function readOnceMarker(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeOnceMarker(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* sessionStorage unavailable — overcounting is acceptable */
  }
}
function scrolledKey(proposalId: string, sessionId: string): string {
  return `ss-proposal-scrolled-${proposalId}-${sessionId}`;
}
function priceKey(proposalId: string, sessionId: string): string {
  return `ss-price-viewed-${proposalId}-${sessionId}`;
}
function itineraryKey(proposalId: string, sessionId: string): string {
  return `ss-itinerary-clicked-${proposalId}-${sessionId}`;
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

// Section root → section type. Reads data-section-type off the
// observed root, falling back to the nearest ancestor that carries
// it. DayCard and PricingSection set this attribute on the root they
// also mark with id="day-..." / id="section-...", so the lookup is
// almost always a single dataset read. Returns null when the root
// has no type (e.g. legacy sections), letting Inspector AI ignore
// dwell that can't be bucketed.
function sectionTypeOf(el: HTMLElement): string | null {
  const own = el.dataset.sectionType;
  if (own) return own;
  const ancestor = el.closest<HTMLElement>("[data-section-type]");
  return ancestor?.dataset.sectionType ?? null;
}

function post(proposalId: string, body: Record<string, unknown>) {
  void fetch(`/api/public/proposals/${proposalId}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => { /* silent — tracker should never impact the proposal view */ });
}
