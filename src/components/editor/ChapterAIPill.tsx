"use client";

import { useEffect, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";

// ─── ChapterAIPill ──────────────────────────────────────────────────────
//
// Per-chapter edit chrome for the spread view. Operator clicks the
// small ✦ AI pill that floats top-right of each chapter's right
// column → picks a tone → we rewrite ONLY that chapter's narrative
// fields via /api/ai/tone-shift (same endpoint the proposal-wide
// tool uses; just narrower scope).
//
// Why per-chapter and not just the proposal-wide one:
//   • Operators often want one chapter in a different voice — e.g.
//     keep the cover formal but make the day descriptions more
//     adventurous. The whole-proposal tool would drag everything.
//   • The pill sits IN the chapter so the action is locality-
//     intuitive: "I'm looking at Day-by-Day and I want to change
//     Day-by-Day."
//
// Each chapter passes a `getFields()` callback that returns the
// narrative slice it wants rewritten. Targets are typed so the
// patch can be applied safely back to store actions:
//   - section content (cover greeting / closing letter / etc.)
//   - day field (description / subtitle)
//   - property field (description / whyWeChoseThis / shortDesc)

export type ChapterAIField = {
  /** Stable key the API echoes back. */
  key: string;
  /** Original text — captured at click-time for restore. */
  text: string;
  /** Where to write the rewrite back to. */
  target: ChapterAIFieldTarget;
};

export type ChapterAIFieldTarget =
  | { kind: "sectionContent"; sectionId: string; field: string }
  | { kind: "day"; dayId: string; field: "description" | "subtitle" }
  | {
      kind: "property";
      propertyId: string;
      field: "description" | "whyWeChoseThis" | "shortDesc";
    };

type Tone = "warm" | "editorial" | "adventurous" | "luxury" | "brief" | "playful" | "formal";

const TONES: { id: Tone; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "editorial", label: "Editorial" },
  { id: "adventurous", label: "Adventurous" },
  { id: "luxury", label: "Luxury" },
  { id: "brief", label: "Brief" },
  { id: "playful", label: "Playful" },
  { id: "formal", label: "Formal" },
];

export function ChapterAIPill({
  chapterLabel,
  getFields,
  context,
}: {
  /** Human-readable chapter name shown in the menu header. */
  chapterLabel: string;
  /** Returns the fields to rewrite. Called when the user picks a tone
   *  so the snapshot is fresh (covers inline edits made just before). */
  getFields: () => ChapterAIField[];
  context?: {
    tripTitle?: string;
    destinations?: string[];
    nights?: number;
    tripStyle?: string;
    clientName?: string;
  };
}) {
  const { updateSectionContent, updateDay, updateProperty } = useProposalStore();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "working"; tone: Tone }
    | { kind: "applied"; previous: ChapterAIField[]; tone: Tone }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const ref = useRef<HTMLDivElement | null>(null);

  // Click-outside to close the menu (but not while a request is
  // in flight — we want the spinner visible).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (state.kind === "working") return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, state.kind]);

  const apply = async (tone: Tone) => {
    const fields = getFields();
    if (fields.length === 0) {
      setState({ kind: "error", message: "Nothing to rewrite in this chapter." });
      setTimeout(() => setState({ kind: "idle" }), 2200);
      return;
    }
    setState({ kind: "working", tone });
    try {
      const res = await fetch("/api/ai/tone-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          intensity: "subtle",
          fields: fields.map((f) => ({ key: f.key, text: f.text })),
          context,
        }),
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
      const json = (await res.json()) as { fields: { key: string; newText: string }[] };
      const byKey = new Map(json.fields.map((f) => [f.key, f.newText]));

      // Apply patches; remember originals for restore.
      const applied: ChapterAIField[] = [];
      for (const f of fields) {
        const next = byKey.get(f.key);
        if (!next) continue;
        applyToTarget(f.target, next, updateSectionContent, updateDay, updateProperty);
        applied.push(f);
      }
      setState({ kind: "applied", previous: applied, tone });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't rewrite — try again",
      });
      setTimeout(() => setState({ kind: "idle" }), 2800);
    }
  };

  const restore = () => {
    if (state.kind !== "applied") return;
    for (const f of state.previous) {
      applyToTarget(f.target, f.text, updateSectionContent, updateDay, updateProperty);
    }
    setState({ kind: "idle" });
  };

  const inFlight = state.kind === "working";

  return (
    <div ref={ref} className="absolute top-4 right-4 z-30 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={inFlight}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10.5px] font-semibold shadow-md hover:bg-black/75 transition disabled:opacity-70"
        title={`AI tools — ${chapterLabel}`}
      >
        <span aria-hidden style={{ color: "#ffd97a" }}>
          ✦
        </span>
        <span>{inFlight ? "Rewriting…" : "AI"}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
          style={{ minWidth: 240 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2.5 border-b border-white/10">
            <div className="text-[9.5px] uppercase tracking-[0.22em] text-white/45 font-semibold">
              Rewrite in tone
            </div>
            <div className="text-[12px] text-white/85 mt-0.5">{chapterLabel}</div>
          </div>
          <div className="py-1">
            {TONES.map((t) => {
              const working = state.kind === "working" && state.tone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => apply(t.id)}
                  disabled={inFlight}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/8 hover:text-white transition flex items-center justify-between disabled:opacity-50"
                >
                  <span>{t.label}</span>
                  {working && (
                    <span
                      aria-hidden
                      className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"
                    />
                  )}
                </button>
              );
            })}
          </div>
          {state.kind === "applied" && (
            <div className="px-3 py-2.5 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="text-[10.5px] text-white/65">
                Applied · {state.previous.length}{" "}
                {state.previous.length === 1 ? "field" : "fields"}
              </div>
              <button
                type="button"
                onClick={restore}
                className="text-[10.5px] text-white/85 hover:text-white underline"
              >
                Restore
              </button>
            </div>
          )}
          {state.kind === "error" && (
            <div className="px-3 py-2.5 border-t border-white/10">
              <div
                className="text-[10.5px]"
                style={{ color: "#f5a59c" }}
              >
                {state.message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function applyToTarget(
  target: ChapterAIFieldTarget,
  value: string,
  updateSectionContent: (id: string, patch: Record<string, unknown>) => void,
  updateDay: (id: string, patch: Record<string, unknown>) => void,
  updateProperty: (id: string, patch: Record<string, unknown>) => void,
) {
  if (target.kind === "sectionContent") {
    updateSectionContent(target.sectionId, { [target.field]: value });
  } else if (target.kind === "day") {
    updateDay(target.dayId, { [target.field]: value });
  } else if (target.kind === "property") {
    updateProperty(target.propertyId, { [target.field]: value });
  }
}
