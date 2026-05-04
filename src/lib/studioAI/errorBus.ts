"use client";

import { useSyncExternalStore } from "react";

// ─── Studio AI — error bus ────────────────────────────────────────────────
//
// Single-active-error model. When something breaks anywhere in the
// dashboard, the relevant code calls reportError(...). The rescue
// surface (StudioAIOnDuty) listens, picks the calm copy, renders it.
//
// Why single-active rather than a queue? An operator who's seeing
// ten errors at once doesn't need ten reassurances — they need one
// honest "yes, multiple things went sideways, here's what's safe".
// Newer reports replace older ones; the most-recent failure wins.
//
// Auto-clear: errors aren't time-cleared automatically. The operator
// dismisses (or the success of a retry call clears via clearError).
// A nagging surface is better than a silent one when systems are sick.

export type StudioAIErrorKind =
  | "network"        // fetch failed entirely (offline, DNS)
  | "server"         // API returned 5xx
  | "render"         // React error boundary caught a render error
  | "unhandled"      // unhandled promise rejection / window error
  | "action_failed"; // a specific operator-initiated action failed

export type StudioAIError = {
  kind: StudioAIErrorKind;
  /** Short technical message. NOT shown to the operator directly —
   *  rescueCopy() reads this to pick which calm copy to render and
   *  to include in the report payload if the operator clicks
   *  "Report this". */
  message: string;
  /** Optional source label — "GET /api/dashboard/activity" or
   *  "FollowUpPanel send". Helps the report payload be useful. */
  source?: string;
  /** Optional retry callback. When set, the rescue surface renders
   *  a "Try again" button that calls this. Caller is responsible
   *  for clearError() on success. */
  retry?: () => void | Promise<void>;
  /** ms epoch — when this error was reported. */
  at: number;
};

let active: StudioAIError | null = null;
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

export function reportError(input: Omit<StudioAIError, "at">): void {
  active = { ...input, at: Date.now() };
  emit();
}

export function clearError(): void {
  if (active === null) return;
  active = null;
  emit();
}

export function readActiveError(): StudioAIError | null {
  return active;
}

// useSyncExternalStore: same pattern as lastAction. The store
// snapshot is the `active` reference itself (or null) — React sees
// a new reference every time reportError() runs, which is exactly
// when subscribers should re-render.
function getServerErrorSnapshot(): StudioAIError | null {
  return null;
}

export function useActiveError(): StudioAIError | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => active,
    getServerErrorSnapshot,
  );
}
