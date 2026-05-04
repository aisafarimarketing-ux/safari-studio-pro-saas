"use client";

import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon, EmailIcon } from "@/lib/channelIcons";
import { recordAction } from "@/lib/studioAI/lastAction";

// CommandBar — Safari Studio's Execution AI surface.
//
// Centered modal with a single text input. Operator types a natural-
// language command ("send Jennifer day 2 and 3"), the server parses
// intent + retrieves real proposal data + assembles a snippet, and
// this component opens the existing FollowUpPanel with a prefilled
// draft. The operator reviews, then sends — no chat, no agent loop,
// no AI-generated content.
//
// States:
//   "input"          — typing
//   "submitting"     — waiting on /api/ai/execute
//   "disambiguation" — multiple clients matched; operator picks one
//   "error"          — clear failure with the server-supplied message
//
// Closes on ⌘K toggle (handled by parent) / Escape / outside click /
// successful command (the FollowUpPanel takes over).

type ClientLite = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  latestProposalTitle: string | null;
  latestProposalUpdatedAt: string | null;
  /** Direct proposal pointer for reservation / proposal-content
   *  matches (no Prisma Client row exists). When the operator picks
   *  one of these from disambiguation, we send the proposalId back
   *  to the route instead of a clientId. */
  resolvedProposalId?: string;
  source?: "client" | "reservation" | "proposal-content";
};

type ExecuteSuccess = {
  status: "ready";
  suggestionId: string;
  command: string;
  client: ClientLite & { phone: string | null };
  proposal: {
    id: string;
    title: string;
    trackingId: string | null;
    updatedAt: string;
  };
  channel: "whatsapp" | "email";
  preview: { text: string; html: string; subject: string };
  warnings: string[];
  /** Set when the ready response is a preview-itinerary send. Drives
   *  the panel header / context strip so the operator sees they're
   *  sending a preview rather than a follow-up. */
  previewItineraryLabel?: string;
  /** Set when the ready response is a pricing-summary send. Drives
   *  the same header / context-strip swap as previews. */
  pricingSummary?: boolean;
};

type ExecuteDisambiguation = {
  status: "needs_disambiguation";
  command: string;
  matches: ClientLite[];
};

type ExecuteError = {
  status: "error";
  command: string;
  message: string;
};

type ExecuteResponse = ExecuteSuccess | ExecuteDisambiguation | ExecuteError;

type Mode =
  | { kind: "input" }
  | { kind: "submitting" }
  | { kind: "disambiguation"; command: string; matches: ClientLite[] }
  | { kind: "error"; message: string };

const PLACEHOLDER_EXAMPLES = [
  'Try: "send Jennifer day 2 and 3"',
  'Try: "send a 5 day safari to Lilian"',
  'Try: "send pricing to Lilian"',
  'Try: "share a honeymoon safari preview with Mara"',
  'Try: "whatsapp Collins day 1 and 2"',
];

export function CommandBar({
  open,
  prefill,
  onClose,
}: {
  open: boolean;
  /** Initial command string seeded into the input on open. Used by
   *  Inspector AI suggestion chips that pre-fill commands like
   *  "send jennifer day 3" — the operator hits Enter to confirm
   *  rather than retyping. Null/undefined = empty input. */
  prefill?: string | null;
  onClose: () => void;
}) {
  const [command, setCommand] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "input" });
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_EXAMPLES[0]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Rotate the placeholder on every open so the operator gradually
  // discovers more command shapes without us shipping a tutorial.
  // The setState calls are intentional: this effect synchronises the
  // bar's internal state with the externally-controlled `open` prop,
  // which is exactly the legitimate use-case for setState-in-effect
  // (the alternative — `key`-based remount — would force the parent
  // to manage the bar's lifecycle, heavier than the win).
  useEffect(() => {
    if (!open) return;
    const next =
      PLACEHOLDER_EXAMPLES[
        Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)
      ];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaceholder(next);
    setMode({ kind: "input" });
    // Seed the input with the prefilled command when one was passed
    // in (Inspector AI flow); otherwise reset to empty.
    setCommand(prefill?.trim() ?? "");
    // Focus on next tick so the modal mount transition doesn't steal
    // it. When prefilled, also select-all so the operator can either
    // confirm with Enter or type to overwrite.
    const t = setTimeout(() => {
      inputRef.current?.focus();
      if (prefill && inputRef.current) {
        inputRef.current.select();
      }
    }, 30);
    return () => clearTimeout(t);
  }, [open, prefill]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (override?: { clientId?: string; proposalId?: string }) => {
    const trimmed = command.trim();
    if (!trimmed) return;
    setMode({ kind: "submitting" });
    try {
      const res = await fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmed,
          // Prefer proposalId when the picked match was synthesised
          // from a reservation / contentJson hit — the route uses it
          // directly. Fall back to clientId for real Client-row picks.
          ...(override?.proposalId
            ? { proposalId: override.proposalId }
            : override?.clientId
              ? { clientId: override.clientId }
              : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as ExecuteResponse | null;
      if (!data) {
        setMode({ kind: "error", message: "Couldn't reach the server." });
        return;
      }
      if (data.status === "ready") {
        // Hand off to FollowUpPanel via the existing event surface.
        // Three contexts produce different header copy:
        //   - send_proposal_days: "{trip title} · proposal {ago} · {channel}"
        //     and headerSuffix="Follow-up" (the default)
        //   - send_preview_itinerary: "{label} preview · {channel}"
        //     and headerSuffix="Preview"
        //   - send_pricing_summary: "{trip title} · pricing · {channel}"
        //     and headerSuffix="Pricing"
        const channelWord = data.channel === "whatsapp" ? "WhatsApp" : "Email";
        const isPreview = Boolean(data.previewItineraryLabel);
        const isPricing = Boolean(data.pricingSummary);
        const contextLabel = isPreview
          ? `${data.previewItineraryLabel} preview · ${channelWord}`
          : isPricing
            ? `${data.proposal.title} · pricing · ${channelWord}`
            : `${data.proposal.title} · proposal ${formatRelativeShort(data.proposal.updatedAt)} · ${channelWord}`;
        const headerSuffix = isPreview ? "Preview" : isPricing ? "Pricing" : "Follow-up";

        // Record on the Studio AI rescue store. The /execute call
        // resolved a draft cleanly — that's the "last successful
        // action" anchor the rescue surface refers to if anything
        // breaks afterwards. Summary is operator-readable so it
        // can be quoted verbatim ("Your last action — Drafted
        // pricing for Lilian, 2 min ago — went through cleanly.").
        const firstName = data.client.fullName.split(/\s+/)[0] || "client";
        const recordSummary = isPricing
          ? `Drafted pricing for ${firstName}`
          : isPreview
            ? `Drafted ${data.previewItineraryLabel ?? "preview"} for ${firstName}`
            : `Drafted day snippet for ${firstName}`;
        const recordKind = isPricing
          ? ("send_pricing" as const)
          : isPreview
            ? ("send_preview" as const)
            : ("send_proposal_days" as const);
        recordAction({ kind: recordKind, summary: recordSummary });
        window.dispatchEvent(
          new CustomEvent("ss:openFollowUp", {
            detail: {
              proposalId: data.proposal.id,
              clientName: data.client.fullName,
              clientPhone: data.client.phone ?? null,
              clientEmail: data.client.email ?? null,
              prefilledDraft: {
                text: data.preview.text,
                suggestionId: data.suggestionId,
                channel: data.channel,
                contextLabel,
                warnings: data.warnings,
                headerSuffix,
              },
            },
          }),
        );
        onClose();
        return;
      }
      if (data.status === "needs_disambiguation") {
        setMode({
          kind: "disambiguation",
          command: data.command,
          matches: data.matches,
        });
        return;
      }
      // status === "error"
      setMode({ kind: "error", message: data.message });
    } catch (err) {
      setMode({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't reach the server.",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center pt-[18vh] px-4"
      style={{ background: "rgba(15,17,15,0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-label="Safari Studio command bar"
    >
      <div
        className="w-full max-w-[560px] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#F7F3E8", color: "#0a1411" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
        >
          <span aria-hidden style={{ color: "#1b3a2d", fontSize: 18 }}>✦</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && mode.kind !== "submitting") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholder}
            className="flex-1 outline-none bg-transparent text-[15px]"
            style={{ color: "#0a1411" }}
            disabled={mode.kind === "submitting"}
            spellCheck={false}
            autoComplete="off"
          />
          <span
            className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,0.06)", color: "rgba(10,20,17,0.55)" }}
            aria-hidden
          >
            ESC
          </span>
        </div>

        {/* Body — varies by mode */}
        <div className="px-5 py-4">
          {mode.kind === "input" && (
            <div className="text-[12px]" style={{ color: "rgba(10,20,17,0.55)" }}>
              <div className="font-semibold mb-1.5" style={{ color: "rgba(10,20,17,0.7)" }}>
                Safari Studio AI · Execution
              </div>
              <p className="leading-relaxed">
                Type a command to send a snippet of a proposal to a client. We
                resolve the client and the days deterministically — the AI
                only parses what you typed, never invents content.
              </p>
            </div>
          )}

          {mode.kind === "submitting" && (
            <div className="space-y-2">
              <div className="h-3 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.08)" }} />
              <div className="h-3 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.08)" }} />
              <div className="h-3 w-2/3 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.08)" }} />
            </div>
          )}

          {mode.kind === "disambiguation" && (
            <div>
              <div
                className="text-[12px] mb-2"
                style={{ color: "rgba(10,20,17,0.65)" }}
              >
                <strong>{mode.matches.length} matches</strong> — pick the right one:
              </div>
              <ul className="space-y-1.5">
                {mode.matches.map((m) => {
                  const sourceBadge =
                    m.source === "reservation"
                      ? "from booking"
                      : m.source === "proposal-content"
                        ? "from proposal draft"
                        : null;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() =>
                          void submit(
                            m.resolvedProposalId
                              ? { proposalId: m.resolvedProposalId }
                              : { clientId: m.id },
                          )
                        }
                        className="w-full text-left px-3 py-2 rounded-md transition flex items-baseline justify-between gap-2"
                        style={{
                          background: "#ffffff",
                          border: "1px solid rgba(0,0,0,0.10)",
                        }}
                      >
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold truncate flex items-baseline gap-1.5 flex-wrap">
                            <span className="truncate">{m.fullName}</span>
                            {sourceBadge && (
                              <span
                                className="text-[9.5px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  background: "rgba(0,0,0,0.05)",
                                  color: "rgba(10,20,17,0.55)",
                                }}
                              >
                                {sourceBadge}
                              </span>
                            )}
                          </div>
                          <div
                            className="text-[11.5px] truncate"
                            style={{ color: "rgba(10,20,17,0.55)" }}
                          >
                            {m.email || "(no email)"}
                          </div>
                        </div>
                        <div
                          className="text-[11.5px] text-right shrink-0"
                          style={{ color: "rgba(10,20,17,0.55)" }}
                        >
                          {m.latestProposalTitle ? (
                            <>
                              <div className="truncate max-w-[180px]">{m.latestProposalTitle}</div>
                              {m.latestProposalUpdatedAt && (
                                <div style={{ opacity: 0.7 }}>
                                  {formatRelativeShort(m.latestProposalUpdatedAt)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ opacity: 0.5 }}>no proposals</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {mode.kind === "error" && (
            <div
              className="rounded-lg p-3 text-[13px]"
              style={{
                background: "rgba(179,67,52,0.08)",
                color: "#b34334",
                border: "1px solid rgba(179,67,52,0.22)",
              }}
            >
              {mode.message}
              <button
                type="button"
                onClick={() => {
                  setMode({ kind: "input" });
                  inputRef.current?.focus();
                }}
                className="ml-3 text-[12px] font-semibold underline-offset-2 hover:underline"
                style={{ color: "#b34334" }}
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-2.5"
          style={{
            borderTop: "1px solid rgba(0,0,0,0.06)",
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <div
            className="flex items-center gap-3 text-[11px]"
            style={{ color: "rgba(10,20,17,0.55)" }}
          >
            <span className="inline-flex items-center gap-1">
              <WhatsAppIcon size={12} />
              <span>WhatsApp first</span>
            </span>
            <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            <span className="inline-flex items-center gap-1">
              <EmailIcon size={12} />
              <span>Email fallback</span>
            </span>
          </div>
          <div
            className="text-[10.5px]"
            style={{ color: "rgba(10,20,17,0.45)" }}
          >
            Preview opens before sending — every time.
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact relative-time formatter for the disambiguation list /
// context label. Renders as "today", "2d ago", "3w ago", "Mar 4".
function formatRelativeShort(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  if (diffMs < 7 * 86_400_000) return `${Math.floor(diffMs / 86_400_000)}d ago`;
  if (diffMs < 30 * 86_400_000) return `${Math.floor(diffMs / (7 * 86_400_000))}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
