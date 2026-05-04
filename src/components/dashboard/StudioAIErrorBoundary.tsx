"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/studioAI/errorBus";

// ─── Studio AI — render-error boundary ────────────────────────────────────
//
// Catches React render errors anywhere inside the dashboard tree and
// pushes them onto the rescue surface via reportError. The fallback
// UI deliberately stays as plain markup — no heavy components — so
// a bug in one of those components can't recursively crash the
// boundary itself.
//
// React requires error boundaries to be class components (hooks
// can't intercept render-phase throws). The class stays minimal:
// mount → catch → report → render fallback. No retry button on the
// fallback — the operator's path back to a working state is a full
// page refresh; pretending otherwise would lie to them.

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class StudioAIErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Push to the rescue bus so StudioAIOnDuty (mounted at the
    // dashboard root) can surface a calm message. info.componentStack
    // is operator-irrelevant; we keep it in console for debugging
    // but don't pipe it into the user-visible copy.
    reportError({
      kind: "render",
      message: error.message || "Unknown render error",
      source: "react-render",
    });
    console.error("[studio-ai] render boundary caught:", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Minimal fallback — a calm, plain-text apology with a refresh
      // hint. The rescue surface (StudioAIOnDuty) sits above this
      // boundary in the layout tree (mounted at the same level as
      // ToastHost) and stays alive when this boundary trips, so the
      // operator gets the proper rescue card on top of this stub.
      return (
        <div
          style={{
            padding: "32px 24px",
            maxWidth: 480,
            margin: "120px auto",
            textAlign: "center",
            color: "rgba(10,20,17,0.7)",
            fontFamily:
              "-apple-system, Segoe UI, Roboto, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 8,
              color: "rgba(10,20,17,0.5)",
            }}
          >
            Safari Studio
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 22,
              color: "#0a1411",
              marginBottom: 12,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            The screen tripped on something.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
            Your data isn&apos;t affected — only this view crashed
            mid-render. A refresh resets the layout cleanly.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "#1b3a2d",
              color: "#F7F3E8",
              fontWeight: 600,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
