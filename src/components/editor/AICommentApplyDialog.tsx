"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useProposalStore } from "@/store/proposalStore";
import type { Proposal } from "@/lib/types";

// ─── AICommentApplyDialog ───────────────────────────────────────────────
//
// The marquee differentiator. Operator clicks "✦ Apply with AI" on a
// client comment in the comments drawer. We collect the relevant
// proposal slice, hit /api/ai/apply-comment, and Claude returns a
// typed PATCH. This dialog shows the patch as a diff modal — every
// edit visible with old → new — and the operator confirms before
// anything writes.
//
// Why this is the killer move:
//   • Client back-and-forth that took 4 days of email becomes one
//     click + one review.
//   • Operator retains veto on every change. AI proposes; human
//     approves.
//   • Uses our structured data model (proposal.days[],
//     proposal.properties[]) — Safari Portal and other CMS-style
//     competitors can't ship the same flow without rebuilding their
//     data layer.

type Edit =
  | { type: "dayDescription"; dayId: string; newText: string }
  | { type: "daySubtitle"; dayId: string; newText: string }
  | { type: "dayHighlights"; dayId: string; newText: string[] }
  | { type: "propertyDescription"; propertyId: string; newText: string }
  | { type: "propertyWhyChose"; propertyId: string; newText: string }
  | { type: "closingLetter"; newText: string }
  | { type: "closingHeadline"; newText: string }
  | { type: "personalNoteBody"; newText: string };

interface PatchResponse {
  summary: string;
  edits: Edit[];
}

export function AICommentApplyDialog({
  open,
  comment,
  commentId,
  onClose,
  onApplied,
}: {
  open: boolean;
  comment: string;
  /** Optional: when set, we mark the comment resolved after applying. */
  commentId?: string;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const { proposal, updateDay, updateProperty, updateSectionContent } = useProposalStore();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; patch: PatchResponse; selected: Set<number> }
    | { kind: "applying" }
    | { kind: "applied"; count: number }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ kind: "loading" });

    const closing = proposal.sections.find((s) => s.type === "closing");
    const personalNote = proposal.sections.find((s) => s.type === "personalNote");

    const payload = {
      comment,
      trip: {
        title: proposal.trip.title,
        destinations: proposal.trip.destinations,
        nights: proposal.trip.nights,
        tripStyle: proposal.trip.tripStyle,
      },
      client: { guestNames: proposal.client.guestNames },
      days: proposal.days.map((d) => ({
        id: d.id,
        dayNumber: d.dayNumber,
        destination: d.destination,
        subtitle: d.subtitle,
        description: d.description,
        highlights: d.highlights,
      })),
      properties: proposal.properties.map((p) => ({
        id: p.id,
        name: p.name,
        location: p.location,
        description: p.description,
        whyWeChoseThis: p.whyWeChoseThis,
      })),
      closing: closing
        ? {
            headline: closing.content?.headline as string | undefined,
            letter: closing.content?.letter as string | undefined,
          }
        : undefined,
      personalNote: personalNote
        ? { body: personalNote.content?.body as string | undefined }
        : undefined,
    };

    (async () => {
      try {
        const res = await fetch("/api/ai/apply-comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (cancelled) return;
        if (res.status === 401) {
          window.location.href = "/sign-in";
          return;
        }
        if (res.status === 402) {
          window.location.href = "/account-suspended";
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as PatchResponse;
        if (cancelled) return;
        // Default: every edit selected.
        const selected = new Set(json.edits.map((_, i) => i));
        setState({ kind: "ready", patch: json, selected });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Couldn't generate patch — try again.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, comment]);

  if (!open || typeof window === "undefined") return null;

  const apply = async () => {
    if (state.kind !== "ready") return;
    setState({ kind: "applying" });
    let count = 0;
    const closing = proposal.sections.find((s) => s.type === "closing");
    const personalNote = proposal.sections.find((s) => s.type === "personalNote");

    for (let i = 0; i < state.patch.edits.length; i++) {
      if (!state.selected.has(i)) continue;
      const e = state.patch.edits[i];
      switch (e.type) {
        case "dayDescription":
          updateDay(e.dayId, { description: e.newText });
          count++;
          break;
        case "daySubtitle":
          updateDay(e.dayId, { subtitle: e.newText });
          count++;
          break;
        case "dayHighlights":
          updateDay(e.dayId, { highlights: e.newText });
          count++;
          break;
        case "propertyDescription":
          updateProperty(e.propertyId, { description: e.newText });
          count++;
          break;
        case "propertyWhyChose":
          updateProperty(e.propertyId, { whyWeChoseThis: e.newText });
          count++;
          break;
        case "closingLetter":
          if (closing) {
            updateSectionContent(closing.id, { letter: e.newText });
            count++;
          }
          break;
        case "closingHeadline":
          if (closing) {
            updateSectionContent(closing.id, { headline: e.newText });
            count++;
          }
          break;
        case "personalNoteBody":
          if (personalNote) {
            updateSectionContent(personalNote.id, { body: e.newText });
            count++;
          }
          break;
      }
    }

    // Optionally mark comment resolved.
    if (commentId) {
      try {
        await fetch(`/api/proposals/${proposal.id}/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        });
      } catch {
        /* non-fatal */
      }
    }

    setState({ kind: "applied", count });
    onApplied?.();
  };

  const toggle = (idx: number) => {
    if (state.kind !== "ready") return;
    const next = new Set(state.selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setState({ ...state, selected: next });
  };

  return createPortal(
    <>
      <div
        onClick={state.kind === "applying" ? undefined : onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.42)",
          backdropFilter: "blur(2px)",
          zIndex: 10000,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI comment apply"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 720,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.32), 0 4px 12px rgba(0,0,0,0.18)",
          border: "1px solid rgba(0,0,0,0.08)",
          zIndex: 10001,
          fontFamily: "inherit",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/6 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-black/45">
              AI Tools — Apply comment
            </div>
            <div className="text-[15px] font-semibold text-black/85 mt-0.5">
              Apply this client comment with AI
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={state.kind === "applying"}
            className="w-7 h-7 rounded-full text-black/45 hover:bg-black/5 hover:text-black/75 transition flex items-center justify-center text-[16px] disabled:opacity-50"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-auto flex-1 min-h-0">
          {/* The original comment */}
          <div
            className="px-3.5 py-3 rounded-lg mb-4 text-[13px] italic"
            style={{ background: "rgba(201,168,76,0.08)", color: "#5a4a1f" }}
          >
            “{comment}”
          </div>

          {state.kind === "loading" && (
            <div className="flex items-center gap-3 text-[13px] text-black/55 py-6">
              <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
              <span>Reading the proposal and drafting changes…</span>
            </div>
          )}

          {state.kind === "error" && (
            <div
              className="px-3.5 py-3 rounded-lg text-[13px]"
              style={{ background: "rgba(179,67,52,0.08)", color: "#b34334" }}
            >
              {state.message}
            </div>
          )}

          {(state.kind === "ready" || state.kind === "applying") && (
            <>
              <div className="text-[12.5px] mb-4" style={{ color: "#1b3a2d" }}>
                <span className="font-semibold">AI summary:</span> {state.kind === "ready" ? state.patch.summary : ""}
              </div>
              {state.kind === "ready" && state.patch.edits.length === 0 && (
                <div className="text-[13px] text-black/55 italic py-4">
                  AI didn&rsquo;t propose any field-level edits for this comment. The
                  request may need a structural change (add/remove a day,
                  swap a property) — handle it in the editor directly.
                </div>
              )}
              {state.kind === "ready" &&
                state.patch.edits.map((edit, i) => (
                  <EditDiff
                    key={i}
                    edit={edit}
                    selected={state.selected.has(i)}
                    onToggle={() => toggle(i)}
                    proposal={proposal}
                  />
                ))}
              {state.kind === "applying" && (
                <div className="flex items-center gap-3 text-[13px] text-black/55 py-3">
                  <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
                  <span>Applying changes…</span>
                </div>
              )}
            </>
          )}

          {state.kind === "applied" && (
            <div
              className="px-3.5 py-3 rounded-lg text-[13px]"
              style={{ background: "rgba(45,90,64,0.08)", color: "#1b3a2d" }}
            >
              Applied {state.count} {state.count === 1 ? "edit" : "edits"}. The
              comment has been marked resolved.
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-black/6 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={state.kind === "applying"}
            className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-lg text-black/60 hover:bg-black/5 transition disabled:opacity-50"
          >
            {state.kind === "applied" ? "Done" : "Cancel"}
          </button>
          {state.kind === "ready" && state.patch.edits.length > 0 && (
            <button
              type="button"
              onClick={apply}
              className="px-3.5 py-1.5 text-[12.5px] font-semibold rounded-lg bg-[#1b3a2d] text-white hover:bg-[#244e3c] transition inline-flex items-center gap-2"
            >
              ✦ Apply {state.selected.size}{" "}
              {state.selected.size === 1 ? "edit" : "edits"}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

// One per-edit diff card in the dialog. Shows the field's old text
// (where retrievable) faintly above the new text, with a checkbox so
// operators can deselect specific edits before applying.
function EditDiff({
  edit,
  selected,
  onToggle,
  proposal,
}: {
  edit: Edit;
  selected: boolean;
  onToggle: () => void;
  proposal: Proposal;
}) {
  const old = resolveOldText(edit, proposal);
  const newText = formatNewText(edit);
  const target = describeTarget(edit, proposal);

  return (
    <label
      className="block mb-3 rounded-lg border transition cursor-pointer"
      style={{
        borderColor: selected ? "rgba(27,58,45,0.35)" : "rgba(0,0,0,0.08)",
        background: selected ? "rgba(27,58,45,0.04)" : "#ffffff",
      }}
    >
      <div className="px-3 py-2.5 flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 accent-[#1b3a2d]"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-black/55 mb-1.5">
            {target}
          </div>
          {old && (
            <div
              className="text-[12.5px] leading-snug whitespace-pre-line line-through mb-1.5"
              style={{ color: "rgba(0,0,0,0.45)" }}
            >
              {old.length > 240 ? old.slice(0, 240) + "…" : old}
            </div>
          )}
          <div
            className="text-[13px] leading-snug whitespace-pre-line"
            style={{ color: "#101828" }}
          >
            {newText}
          </div>
        </div>
      </div>
    </label>
  );
}

function describeTarget(
  edit: Edit,
  proposal: Proposal,
): string {
  switch (edit.type) {
    case "dayDescription":
    case "daySubtitle":
    case "dayHighlights": {
      const day = proposal.days.find((d) => d.id === edit.dayId);
      const labelKind =
        edit.type === "dayDescription"
          ? "Description"
          : edit.type === "daySubtitle"
            ? "Subtitle"
            : "Highlights";
      const where = day ? `Day ${day.dayNumber} · ${day.destination}` : edit.dayId;
      return `${where} → ${labelKind}`;
    }
    case "propertyDescription":
    case "propertyWhyChose": {
      const prop = proposal.properties.find((p) => p.id === edit.propertyId);
      const labelKind = edit.type === "propertyDescription" ? "Description" : "Why we chose this";
      return `${prop?.name ?? edit.propertyId} → ${labelKind}`;
    }
    case "closingLetter":
      return "Closing → Letter";
    case "closingHeadline":
      return "Closing → Headline";
    case "personalNoteBody":
      return "Personal note → Body";
  }
}

function resolveOldText(
  edit: Edit,
  proposal: Proposal,
): string {
  switch (edit.type) {
    case "dayDescription":
      return proposal.days.find((d) => d.id === edit.dayId)?.description ?? "";
    case "daySubtitle":
      return proposal.days.find((d) => d.id === edit.dayId)?.subtitle ?? "";
    case "dayHighlights":
      return (
        proposal.days.find((d) => d.id === edit.dayId)?.highlights?.join(" · ") ?? ""
      );
    case "propertyDescription":
      return proposal.properties.find((p) => p.id === edit.propertyId)?.description ?? "";
    case "propertyWhyChose":
      return (
        proposal.properties.find((p) => p.id === edit.propertyId)?.whyWeChoseThis ?? ""
      );
    case "closingLetter":
      return (
        (proposal.sections.find((s) => s.type === "closing")?.content?.letter as string | undefined) ?? ""
      );
    case "closingHeadline":
      return (
        (proposal.sections.find((s) => s.type === "closing")?.content?.headline as string | undefined) ?? ""
      );
    case "personalNoteBody":
      return (
        (proposal.sections.find((s) => s.type === "personalNote")?.content?.body as string | undefined) ?? ""
      );
  }
}

function formatNewText(edit: Edit): string {
  if (edit.type === "dayHighlights") return edit.newText.map((h) => `· ${h}`).join("\n");
  return edit.newText;
}
