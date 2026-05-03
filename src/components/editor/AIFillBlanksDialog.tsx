"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useProposalStore } from "@/store/proposalStore";
import type { Proposal } from "@/lib/types";

// ─── AIFillBlanksDialog ─────────────────────────────────────────────────
//
// Operator clicks ✦ Fill Blanks in the toolbar. We scan the proposal
// for empty narrative fields (day subtitle/description/highlights,
// property description/whyWeChoseThis, closing letter, personal note
// body), send the whole context to /api/ai/fill-blanks, and Claude
// returns a typed PATCH that fills every blank in one go.
//
// Same diff-modal pattern as AICommentApplyDialog — every proposed
// edit visible with a checkbox; operator approves before any field
// writes. Different prompt: "create from scratch using context"
// instead of "respond to a comment".
//
// Two modes:
//   • blanksOnly (default) — only fill empty fields. Safe for
//     proposals that already have some operator-written content.
//   • rewriteAll          — regenerate every narrative field from
//     scratch (for the operator who wants a complete redraft).

type Edit =
  | { type: "dayDescription"; dayId: string; newText: string }
  | { type: "daySubtitle"; dayId: string; newText: string }
  | { type: "dayHighlights"; dayId: string; newText: string[] }
  | { type: "propertyDescription"; propertyId: string; newText: string }
  | { type: "propertyWhyChose"; propertyId: string; newText: string }
  | { type: "closingLetter"; newText: string }
  | { type: "personalNoteBody"; newText: string };

interface PatchResponse {
  summary: string;
  edits: Edit[];
}

export function AIFillBlanksDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { proposal, updateDay, updateProperty, updateSectionContent } = useProposalStore();
  const [rewriteAll, setRewriteAll] = useState(false);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; patch: PatchResponse; selected: Set<number> }
    | { kind: "applying" }
    | { kind: "applied"; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Reset state when the dialog re-opens.
  useEffect(() => {
    if (open) {
      setState({ kind: "idle" });
      setRewriteAll(false);
    }
  }, [open]);

  // Pre-count empty fields for the operator-facing summary on the
  // initial screen.
  const emptyCount = (() => {
    if (!open) return 0;
    let n = 0;
    for (const d of proposal.days) {
      if (!d.subtitle?.trim()) n++;
      if (!d.description?.trim()) n++;
      if ((d.highlights ?? []).length === 0) n++;
    }
    for (const p of proposal.properties) {
      if (!p.description?.trim()) n++;
      if (!p.whyWeChoseThis?.trim()) n++;
    }
    const closing = proposal.sections.find((s) => s.type === "closing");
    if (closing && !(closing.content?.letter as string | undefined)?.trim()) n++;
    const personalNote = proposal.sections.find((s) => s.type === "personalNote");
    if (personalNote && !(personalNote.content?.body as string | undefined)?.trim()) n++;
    return n;
  })();

  if (!open || typeof window === "undefined") return null;

  const run = async (rewriteAllFlag: boolean) => {
    setState({ kind: "loading" });
    setRewriteAll(rewriteAllFlag);

    const closing = proposal.sections.find((s) => s.type === "closing");
    const personalNote = proposal.sections.find((s) => s.type === "personalNote");

    const payload = {
      trip: {
        title: proposal.trip.title,
        destinations: proposal.trip.destinations,
        nights: proposal.trip.nights,
        tripStyle: proposal.trip.tripStyle,
        arrivalDate: proposal.trip.arrivalDate,
      },
      client: { guestNames: proposal.client.guestNames },
      days: proposal.days.map((d) => ({
        id: d.id,
        dayNumber: d.dayNumber,
        destination: d.destination,
        country: d.country,
        subtitle: d.subtitle,
        description: d.description,
        highlights: d.highlights,
        campName: d.tiers?.[proposal.activeTier]?.camp,
      })),
      properties: proposal.properties.map((p) => ({
        id: p.id,
        name: p.name,
        location: p.location,
        description: p.description,
        whyWeChoseThis: p.whyWeChoseThis,
        amenities: p.amenities,
        propertyClass: p.propertyClass,
      })),
      closing: closing
        ? {
            letterEmpty: !(closing.content?.letter as string | undefined)?.trim(),
          }
        : undefined,
      personalNote: personalNote
        ? {
            bodyEmpty: !(personalNote.content?.body as string | undefined)?.trim(),
          }
        : undefined,
      rewriteAll: rewriteAllFlag,
    };

    try {
      const res = await fetch("/api/ai/fill-blanks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
      const selected = new Set(json.edits.map((_, i) => i));
      setState({ kind: "ready", patch: json, selected });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't generate — try again.",
      });
    }
  };

  const apply = () => {
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
        case "personalNoteBody":
          if (personalNote) {
            updateSectionContent(personalNote.id, { body: e.newText });
            count++;
          }
          break;
      }
    }

    setState({ kind: "applied", count });
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
        onClick={state.kind === "applying" || state.kind === "loading" ? undefined : onClose}
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
        aria-label="AI fill blanks"
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
              AI Tools — Fill blanks
            </div>
            <div className="text-[15px] font-semibold text-black/85 mt-0.5">
              Let AI fill the empty narrative fields
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={state.kind === "loading" || state.kind === "applying"}
            className="w-7 h-7 rounded-full text-black/45 hover:bg-black/5 hover:text-black/75 transition flex items-center justify-center text-[16px] disabled:opacity-50"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-auto flex-1 min-h-0">
          {state.kind === "idle" && (
            <>
              <div className="text-[13px] text-black/65 leading-snug mb-5">
                We&rsquo;ll use the trip context — destinations, dates, days, and
                property picks — to draft narrative for any blank field. Then
                you review the diff and approve. Two modes:
              </div>

              <div className="space-y-2 mb-5">
                <button
                  type="button"
                  onClick={() => run(false)}
                  className="w-full text-left px-4 py-3 rounded-lg border transition hover:border-[#1b3a2d] hover:bg-[#1b3a2d]/[0.03]"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-[13px] text-black/85">
                      Fill blanks only
                    </div>
                    <span
                      className="text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded font-bold"
                      style={{
                        background: "rgba(45,90,64,0.10)",
                        color: "#1b3a2d",
                      }}
                    >
                      {emptyCount} {emptyCount === 1 ? "field" : "fields"}
                    </span>
                  </div>
                  <div className="text-[12px] text-black/55 mt-1">
                    Only generates copy for fields that are currently empty.
                    Operator-written content is preserved.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => run(true)}
                  className="w-full text-left px-4 py-3 rounded-lg border transition hover:border-[#b06a3b] hover:bg-[#b06a3b]/[0.03]"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                >
                  <div className="font-semibold text-[13px] text-black/85">
                    Regenerate everything
                  </div>
                  <div className="text-[12px] text-black/55 mt-1">
                    Drafts every narrative field from scratch — overwrites
                    existing copy. You&rsquo;ll see a diff before anything saves.
                  </div>
                </button>
              </div>

              {emptyCount === 0 && (
                <div className="text-[12px] italic text-black/50">
                  Every narrative field is already populated. Use Regenerate
                  to redraft them.
                </div>
              )}
            </>
          )}

          {state.kind === "loading" && (
            <div className="flex items-center gap-3 text-[13px] text-black/55 py-8">
              <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
              <span>
                {rewriteAll
                  ? "Drafting fresh copy for every field…"
                  : "Drafting copy for the empty fields…"}
              </span>
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
                <span className="font-semibold">Safari Studio AI:</span>{" "}
                {state.kind === "ready" ? state.patch.summary : ""}
              </div>
              {state.kind === "ready" && state.patch.edits.length === 0 && (
                <div className="text-[13px] text-black/55 italic py-4">
                  No edits proposed.
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
              Filled {state.count} {state.count === 1 ? "field" : "fields"}.
              Review the proposal — every line is editable as usual.
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-black/6 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={state.kind === "loading" || state.kind === "applying"}
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

function describeTarget(edit: Edit, proposal: Proposal): string {
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
    case "personalNoteBody":
      return "Personal note → Body";
  }
}

function resolveOldText(edit: Edit, proposal: Proposal): string {
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
