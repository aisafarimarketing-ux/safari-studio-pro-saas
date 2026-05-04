"use client";

import { useSyncExternalStore } from "react";

// ─── Studio AI — last successful action store ──────────────────────────────
//
// Tiny client-side ring buffer of the operator's most-recent
// successful actions. Read by the rescue surface (StudioAIOnDuty) so
// when something breaks, the calm message can anchor on a real
// reference point — "your last send (pricing to Lilian, 2 min ago)
// went through cleanly" — instead of a generic "your data is safe".
//
// Scope: in-memory only. A refresh clears the list — that's fine.
// We're not building an audit log here (the AISuggestion / activity
// tables already serve that role). This is a UX prop for the rescue
// copy, nothing more.
//
// Pattern: module-level mutable + Set<listener>. No Zustand, no
// Redux, no React Context — keeping the surface tiny so future
// sessions can grok it in a single read.

const MAX_ACTIONS = 5;

export type StudioAIAction = {
  /** Stable identifier for the action — matches one of the three
   *  core flows. Used by rescueCopy to phrase references naturally
   *  ("Your last send..." vs "Your last preview..."). */
  kind: "send_pricing" | "send_proposal_days" | "send_preview" | "other";
  /** Operator-readable one-line summary. e.g. "Sent pricing to Lilian"
   *  or "Sent Day 2 and 3 to Jennifer". The rescue surface renders
   *  this verbatim. */
  summary: string;
  /** When the action completed. ms epoch. */
  at: number;
};

const actions: StudioAIAction[] = [];
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

export function recordAction(input: Omit<StudioAIAction, "at">): void {
  actions.unshift({ ...input, at: Date.now() });
  if (actions.length > MAX_ACTIONS) actions.length = MAX_ACTIONS;
  refreshSnapshot();
  emit();
}

export function readLastActions(): StudioAIAction[] {
  return actions.slice();
}

// React hook — re-renders subscribers when the list changes. Built
// on useSyncExternalStore (React 18+ canonical pattern for external
// stores) so we get StrictMode-safety and tearing-free reads without
// hand-rolling effect lifecycles.
//
// getSnapshot must return a stable reference between calls when the
// underlying data hasn't changed — we mutate `actions` in place and
// then re-emit, but the snapshot reference returned to React must be
// stable; we cache the latest snapshot and only refresh it inside
// recordAction. The closure-captured `cachedSnapshot` is the value
// React reads on every render until emit() bumps it.
let cachedSnapshot: StudioAIAction[] = actions.slice();

function refreshSnapshot() {
  cachedSnapshot = actions.slice();
}

const SERVER_SNAPSHOT: StudioAIAction[] = [];
function getServerSnapshot(): StudioAIAction[] {
  // No actions on the server — first paint matches "fresh" state.
  return SERVER_SNAPSHOT;
}

export function useLastActions(): StudioAIAction[] {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => cachedSnapshot,
    getServerSnapshot,
  );
}
