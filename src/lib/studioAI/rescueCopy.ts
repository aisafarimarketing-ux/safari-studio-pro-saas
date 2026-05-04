// ─── Studio AI — rescue copy composer ─────────────────────────────────────
//
// Pure function. Given an active error + the most-recent successful
// actions, return the calm copy the rescue surface renders. No DOM,
// no React, no IO — testable and deterministic so future-us can
// audit the operator-facing language without running the app.
//
// Tone rules (mirror the rest of Studio AI's copy discipline):
//   • Calm, not alarmed. "Hiccuped" / "snag" beat "error" / "failed".
//   • Reassure first, then guide. The operator's reflex on seeing
//     a broken UI is "what did I lose?" — the headline answers that
//     before anything else.
//   • Reference last action when present. "Your last send (X) went
//     through cleanly" gives the operator a real anchor that a
//     generic "data is safe" line can't.
//   • Tell them what still works. The dashboard might be sick but
//     the Command Bar (⌘K) is independent — saying so prevents a
//     full-tool panic.
//   • Honest about the next step. "Refresh in 30s" or "I'll keep
//     trying" — not a vague "we're working on it".
//
// No new content invented based on the error message — operator
// never sees raw stack traces or technical detail.

import type { StudioAIError } from "./errorBus";
import type { StudioAIAction } from "./lastAction";

export type RescueCopy = {
  /** Bold first line — the reassurance. ~60 chars max so it fits in
   *  the rescue card without wrapping awkwardly on narrow screens. */
  headline: string;
  /** Body paragraph(s). One or two short sentences. */
  body: string;
  /** Suggested "what to do right now" line — a concrete guide. Empty
   *  string suppresses the line entirely. */
  hint: string;
  /** Whether to render the "Try again" button. Caller decides
   *  separately whether the error has an attached retry callback. */
  showRetry: boolean;
};

export function composeRescueCopy(
  error: StudioAIError,
  lastActions: StudioAIAction[],
): RescueCopy {
  const lastRef = lastActions.length > 0 ? formatLastReference(lastActions[0]) : null;

  switch (error.kind) {
    case "network":
      return {
        headline: "Network looks shaky on my end.",
        body: lastRef
          ? `${lastRef} The connection just dropped briefly — your work is safe.`
          : "The connection just dropped briefly — nothing in progress was lost.",
        hint: "When the bar at the top of the browser stops complaining about offline, try again. ⌘K still works locally if you want to draft commands meanwhile.",
        showRetry: true,
      };
    case "server":
      return {
        headline: "Something on my side hiccuped.",
        body: lastRef
          ? `${lastRef} The dashboard hit a snag refreshing — that's a display issue, not a data issue.`
          : "The dashboard hit a snag — that's a display issue, not a data issue. Anything already sent stays sent.",
        hint: "Try again in 30 seconds. If it keeps happening, tap Report and I'll bundle a quick note for the team.",
        showRetry: true,
      };
    case "render":
      return {
        headline: "The screen tripped over something.",
        body: lastRef
          ? `${lastRef} The dashboard view crashed mid-render — your data isn't affected.`
          : "The dashboard view crashed mid-render. Nothing was lost — only the layout needs a reset.",
        hint: "Refresh the page. If the same crash repeats after a refresh, tap Report so we can fix it properly.",
        showRetry: false,
      };
    case "unhandled":
      return {
        headline: "An async task failed quietly.",
        body: lastRef
          ? `${lastRef} Something running in the background didn't finish — your visible state is fine.`
          : "Something running in the background didn't finish. Nothing on screen is wrong; you can keep working.",
        hint: "Carry on. If the next action you take also stalls, refresh and tap Report.",
        showRetry: false,
      };
    case "action_failed":
      return {
        headline: "That action didn't go through.",
        body: lastRef
          ? `${lastRef} The most recent attempt didn't complete — nothing partial was saved.`
          : "The action didn't complete — nothing partial was saved. You can try again or take a different path.",
        hint: error.source
          ? `If it keeps failing on the same step (${error.source}), tap Report and we'll look at it.`
          : "If it keeps failing, tap Report and we'll look at it.",
        showRetry: true,
      };
  }
}

// "Your last send (Sent pricing to Lilian, 2 min ago) went through cleanly."
//
// Format dual-purpose: it's the reassurance AND the proof — the
// operator immediately knows the system tracked their action and
// nothing was lost between then and now.
function formatLastReference(action: StudioAIAction): string {
  const ago = formatAgo(Date.now() - action.at);
  return `Your last action (${action.summary}, ${ago}) went through cleanly.`;
}

function formatAgo(ms: number): string {
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins === 1) return "a min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? "1 h ago" : `${hours} h ago`;
}

// Compose a structured report payload. Caller copies it to the
// clipboard / opens a mailto: with this body. We deliberately keep
// the sensitive surface narrow — the operator's last actions are
// summaries (not full message bodies), and the error message is
// the technical string we already showed nowhere visible.
export function composeReportPayload(
  error: StudioAIError,
  lastActions: StudioAIAction[],
): string {
  const lines: string[] = [];
  lines.push("Safari Studio — error report");
  lines.push("");
  lines.push(`Kind: ${error.kind}`);
  lines.push(`When: ${new Date(error.at).toISOString()}`);
  if (error.source) lines.push(`Source: ${error.source}`);
  lines.push(`Message: ${error.message}`);
  if (lastActions.length > 0) {
    lines.push("");
    lines.push("Recent actions (most-recent first):");
    for (const a of lastActions) {
      const ago = Math.round((Date.now() - a.at) / 60_000);
      lines.push(`  • ${a.summary} (${ago} min ago, ${a.kind})`);
    }
  }
  lines.push("");
  lines.push(
    "Page: " +
      (typeof window !== "undefined" ? window.location.pathname : "(server)"),
  );
  lines.push(
    "User-agent: " +
      (typeof navigator !== "undefined" ? navigator.userAgent : "(server)"),
  );
  return lines.join("\n");
}
