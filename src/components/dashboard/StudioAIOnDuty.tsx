"use client";

import { useEffect, useState } from "react";
import {
  clearError,
  reportError,
  useActiveError,
} from "@/lib/studioAI/errorBus";
import { useLastActions } from "@/lib/studioAI/lastAction";
import {
  composeRescueCopy,
  composeReportPayload,
} from "@/lib/studioAI/rescueCopy";

// ─── Studio AI — On Duty rescue surface ───────────────────────────────────
//
// Floating bottom-right card that activates when the error bus has
// an active error. Renders calm, action-oriented copy keyed to the
// error kind, anchored on the operator's most-recent successful
// action when one is available.
//
// Three triggers feed the bus:
//   1. Render errors via StudioAIErrorBoundary (catches React throws)
//   2. Unhandled async errors via window.addEventListener (this file)
//   3. Direct reportError() calls from any handler that knows it
//      just failed in a way the operator should see
//
// Mounted ONCE at the dashboard root (CommandCenter). Independent of
// the error boundary in the layout tree so a render crash leaves
// this surface alive on top of the boundary's fallback.
//
// Buttons:
//   • Try again — only when the error came with a retry callback.
//     Calls retry() then clears the error if the call resolves.
//   • Report — copies a structured report payload to clipboard,
//     toasts a confirmation. Operator pastes into Slack / email.
//   • Dismiss — clears the error without resolution. The operator
//     accepts what's broken and continues working.

export function StudioAIOnDuty() {
  const error = useActiveError();

  // Global safety-net listeners. Any uncaught async error or
  // unhandled promise rejection in the page lands on the bus —
  // operator sees a calm card instead of the silent treatment.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onError = (event: ErrorEvent) => {
      const message = event.message || "Unknown error";
      // Skip the noise from script-loading errors that originate
      // outside the app (browser extensions, etc.). Cross-origin
      // errors arrive as a bare "Script error." message — those
      // never carry useful information for the operator.
      if (message === "Script error." || !message) return;
      reportError({
        kind: "unhandled",
        message,
        source: "window.error",
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      reportError({
        kind: "unhandled",
        message,
        source: "unhandledrejection",
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!error) return null;

  // Extracted body keyed on error.at so a new error report mounts
  // a fresh subtree — that resets transient UI flags (reported /
  // retrying) without us having to setState inside an effect.
  return <RescueCard error={error} key={error.at} />;
}

function RescueCard({ error }: { error: NonNullable<ReturnType<typeof useActiveError>> }) {
  const lastActions = useLastActions();
  const [reported, setReported] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const copy = composeRescueCopy(error, lastActions);

  const handleRetry = async () => {
    if (!error.retry) return;
    setRetrying(true);
    try {
      await error.retry();
      // Caller is the source of truth on retry success — they
      // should call clearError() themselves after the retried call
      // returns OK. We give them ~250ms grace before re-enabling
      // the button so a fast-clearing retry doesn't flicker.
      setTimeout(() => setRetrying(false), 250);
    } catch {
      // Retry failed — refresh the error timestamp so the surface
      // stays visible and the body copy regenerates.
      reportError({
        kind: error.kind,
        message: error.message,
        source: error.source,
        retry: error.retry,
      });
      setRetrying(false);
    }
  };

  const handleReport = async () => {
    const payload = composeReportPayload(error, lastActions);
    try {
      await navigator.clipboard.writeText(payload);
      setReported(true);
    } catch {
      /* clipboard unavailable — silently no-op; operator can dismiss */
    }
  };

  return (
    <div
      role="alertdialog"
      aria-label="Safari Studio AI · On Duty"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        width: "min(380px, calc(100vw - 36px))",
        background: "#F7F3E8",
        color: "#0a1411",
        borderRadius: 14,
        boxShadow:
          "0 22px 60px rgba(10,20,17,0.22), 0 4px 14px rgba(10,20,17,0.10)",
        border: "1px solid rgba(10,20,17,0.08)",
        zIndex: 1200,
        fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px 10px",
          borderBottom: "1px solid rgba(10,20,17,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            aria-hidden
            style={{
              color: "#1b3a2d",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✦
          </span>
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "rgba(10,20,17,0.6)",
            }}
          >
            Safari Studio AI · On Duty
          </span>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={clearError}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(10,20,17,0.5)",
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            marginBottom: 8,
          }}
        >
          {copy.headline}
        </div>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(10,20,17,0.85)",
            margin: "0 0 10px",
          }}
        >
          {copy.body}
        </p>
        {copy.hint && (
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "rgba(10,20,17,0.65)",
              margin: 0,
            }}
          >
            {copy.hint}
          </p>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          {copy.showRetry && error.retry && (
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                background: "#1b3a2d",
                color: "#F7F3E8",
                fontWeight: 600,
                fontSize: 12.5,
                border: "none",
                cursor: retrying ? "default" : "pointer",
                opacity: retrying ? 0.6 : 1,
              }}
            >
              {retrying ? "Trying…" : "Try again"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleReport()}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              background: "rgba(10,20,17,0.06)",
              color: "#0a1411",
              fontWeight: 500,
              fontSize: 12.5,
              border: "none",
              cursor: "pointer",
            }}
          >
            {reported ? "Copied to clipboard" : "Report this"}
          </button>
          <button
            type="button"
            onClick={clearError}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              background: "transparent",
              color: "rgba(10,20,17,0.6)",
              fontWeight: 500,
              fontSize: 12.5,
              border: "none",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
