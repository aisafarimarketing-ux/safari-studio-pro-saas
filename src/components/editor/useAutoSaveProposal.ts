"use client";

import { useEffect, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { recompressProposalImages } from "@/lib/recompressProposalImages";

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
  // Prevents re-entering the auto-heal flow if a single heal pass couldn't
  // bring the payload under the cap. Reset after each successful save so
  // a later batch of uploads can trigger healing again.
  const healedOnceRef = useRef<boolean>(false);
  const healingRef = useRef<boolean>(false);

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
      // an opaque "Unterminated string at position N" later.
      const MAX_PAYLOAD_BYTES = 9.5 * 1024 * 1024;
      if (payload.length > MAX_PAYLOAD_BYTES) {
        // A heal is already running — let it finish and drive the retry.
        if (healingRef.current) return;
        // Auto-heal: if the payload is fat because the proposal still
        // carries inline base64 images (legacy proposals created before
        // Supabase Storage was wired up), silently recompress and upload
        // them, then let the subscribe loop retry the save.
        const hasInlineImages = payload.includes('"data:image/');
        if (hasInlineImages && !healedOnceRef.current) {
          healedOnceRef.current = true;
          healingRef.current = true;
          setState("saving");
          setError(null);
          try {
            const result = await recompressProposalImages(current);
            // hydrateProposal fires a store update, which re-triggers
            // schedule() → save() via the subscription below. The retry
            // runs the size guard again; if we cleared it, it proceeds.
            useProposalStore.getState().hydrateProposal(result.proposal);
            return;
          } catch (err) {
            console.error("[autoSave] auto-heal failed:", err);
            // fall through to the size error below
          } finally {
            healingRef.current = false;
          }
        }
        const mb = (payload.length / 1024 / 1024).toFixed(1);
        setError(
          `Proposal is ${mb}MB — too big to auto-save. Remove or replace some uploaded images, then try again.`,
        );
        setState("error");
        return;
      }
      inFlightRef.current = true;
      setState("saving");
      setError(null);
      try {
        const postOnce = () =>
          fetch("/api/proposals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });

        let res = await postOnce();

        // Transient 401s happen when a Clerk session token is refreshing
        // mid-flight. Retrying once after a short pause lets the new token
        // attach. Auto-redirecting on the first 401 used to yank the user
        // out of the editor mid-edit — the sign-in page sees them as still
        // signed in and bounces them to /dashboard, which presents as the
        // editor "randomly jumping to dashboard". Don't do that.
        if (res.status === 401) {
          await new Promise((r) => setTimeout(r, 1500));
          res = await postOnce();
        }
        if (res.status === 401) {
          throw new Error("Session expired — refresh the page to sign in again.");
        }
        if (res.status === 402) { window.location.href = "/account-suspended"; return; }
        if (res.status === 409) { window.location.href = "/select-organization"; return; }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        // Persist active id so a refresh reloads the same proposal.
        try { localStorage.setItem("activeProposalId", current.id); } catch {}
        lastSerializedRef.current = serialized;
        // A successful save means the current payload is under the cap;
        // clear the heal latch so a later batch of uploads can retry.
        healedOnceRef.current = false;
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
