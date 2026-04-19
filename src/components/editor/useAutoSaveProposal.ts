"use client";

import { useEffect, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";

// Auto-save hook for the proposal editor. Subscribes to the proposal store,
// debounces changes by 800ms, and POSTs the full proposal to /api/proposals
// (the upsert-by-id endpoint). Returns the save state so the toolbar can
// render a live indicator.
//
// Design:
//   - Only runs when `enabled` is true. The editor enables it once the
//     initial load has resolved to a "loaded" outcome — never during the
//     fallback / empty / error states.
//   - Tracks the last JSON we saved. If the current proposal serialises to
//     the same string we skip the network call entirely, so hydrating a
//     freshly-loaded proposal doesn't bounce off the server.
//   - On 401 / 402 / 409, we stop retrying and let the caller handle the
//     redirect (same pattern as the rest of the app).

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useAutoSaveProposal(enabled: boolean): {
  state: SaveState;
  error: string | null;
  lastSavedAt: Date | null;
} {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Imperative refs so we don't have to add every moving part to the effect
  // deps array.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, 800);
    };

    const save = async () => {
      if (inFlightRef.current) {
        // Coalesce — re-schedule once the in-flight save completes.
        schedule();
        return;
      }
      const current = useProposalStore.getState().proposal;
      // Serialise defensively. If the proposal contains anything that
      // can't be stringified (circular ref, function, BigInt), surface
      // that as the save error instead of letting fetch see an empty body.
      let payload: string;
      try {
        payload = JSON.stringify({ proposal: current });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not serialise proposal";
        console.error("[autoSave] JSON.stringify failed:", err);
        setError(msg);
        setState("error");
        return;
      }
      const serialized = JSON.stringify(current);
      if (serialized === lastSerializedRef.current) {
        return; // nothing to save
      }
      // Pre-flight payload-size guard. Vercel/edge proxies truncate bodies
      // at ~10MB, which produces an unparseable JSON tail on the server.
      // Catching it here gives the user an actionable message instead of
      // an opaque "Unterminated string at position N" later. Threshold is
      // a touch under the platform cap so headers + form overhead fit.
      const MAX_PAYLOAD_BYTES = 9 * 1024 * 1024;
      if (payload.length > MAX_PAYLOAD_BYTES) {
        const mb = (payload.length / 1024 / 1024).toFixed(1);
        setError(
          `Proposal is ${mb}MB — too big to auto-save. Remove or replace some uploaded images, then try again. (Image uploads are stored inline; we're moving them to cloud storage to lift this limit.)`,
        );
        setState("error");
        return;
      }
      inFlightRef.current = true;
      setState("saving");
      setError(null);
      try {
        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (res.status === 401) { window.location.href = "/sign-in"; return; }
        if (res.status === 402) { window.location.href = "/account-suspended"; return; }
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        // Persist active id so a refresh reloads the same proposal.
        try { localStorage.setItem("activeProposalId", current.id); } catch {}
        lastSerializedRef.current = serialized;
        setLastSavedAt(new Date());
        setState("saved");
        // Fade the "Saved" label after a moment so the UI settles on "idle".
        setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1600);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setState("error");
      } finally {
        inFlightRef.current = false;
      }
    };

    // Seed lastSerialized with the initial proposal so the first subscription
    // tick (no user change) is a no-op.
    lastSerializedRef.current = JSON.stringify(useProposalStore.getState().proposal);

    const unsubscribe = useProposalStore.subscribe(() => {
      schedule();
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

  return { state, error, lastSavedAt };
}
