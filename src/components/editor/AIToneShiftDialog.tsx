"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useProposalStore } from "@/store/proposalStore";
import type { Proposal } from "@/lib/types";

// ─── AIToneShiftDialog ───────────────────────────────────────────────────
//
// Proposal-wide tone rewrite. Opens from the editor toolbar's AI tools
// menu. Operator picks a tone + intensity; we collect every narrative
// field across the proposal (cover greeting, personal note, every
// day's description + subtitle, every property's description +
// whyWeChoseThis + shortDesc, closing letter + headline + availability),
// send the whole batch to /api/ai/tone-shift, get rewritten text back
// for each, and apply via the store's patch actions in one shot.
//
// Why a single batch instead of per-field rewrites:
//   1. The model sees every field in one context, so the voice stays
//      consistent across the whole proposal — exactly the point of
//      "make this proposal more luxurious".
//   2. One Claude call vs ten — faster and cheaper.
//
// Safety net:
//   • Before applying, we snapshot the original values per field so
//     "Restore previous" can revert. The dialog stays open after
//     applying so the operator can revert with one click.
//   • Facts (place names, prices, dates) are preserved by the
//     server-side prompt — the rewrite is bounded to voice changes.

type Tone = "warm" | "editorial" | "adventurous" | "luxury" | "brief" | "playful" | "formal";
type Intensity = "subtle" | "strong";

const TONE_OPTIONS: { id: Tone; label: string; blurb: string }[] = [
  { id: "warm",        label: "Warm",        blurb: "Personal, inviting; like writing to a friend." },
  { id: "editorial",   label: "Editorial",   blurb: "Magazine-feature rhythm; sensory but grounded." },
  { id: "adventurous", label: "Adventurous", blurb: "Action verbs and geography; quietly bold." },
  { id: "luxury",      label: "Luxury",      blurb: "Service detail over adjectives; confident without showing off." },
  { id: "brief",       label: "Brief",       blurb: "Tight, factual, almost telegraphic." },
  { id: "playful",     label: "Playful",     blurb: "Light dry wit; never cheesy." },
  { id: "formal",      label: "Formal",      blurb: "Full sentences, no contractions; measured distance." },
];

interface NarrativeField {
  /** Stable key the API can echo back. */
  key: string;
  /** Original text — captured at preview time. */
  text: string;
  /** Path back into the store so we can apply the patch. */
  target: FieldTarget;
}

type FieldTarget =
  | { kind: "sectionContent"; sectionId: string; field: string }
  | { kind: "day"; dayId: string; field: "description" | "subtitle" }
  | { kind: "property"; propertyId: string; field: "description" | "whyWeChoseThis" | "shortDesc" };

// Walk the proposal and collect every text field that's a candidate
// for tone-shifting. Excludes: titles, names, addresses, prices,
// times, dates, list items, amenities — anything that shouldn't be
// reworded.
function collectNarrativeFields(proposal: Proposal): NarrativeField[] {
  const out: NarrativeField[] = [];

  // Cover section's greeting body.
  const cover = proposal.sections.find((s) => s.type === "cover");
  if (cover) {
    const body = (cover.content?.greetingBody as string | undefined) ?? "";
    if (body.trim()) {
      out.push({
        key: `section:${cover.id}:greetingBody`,
        text: body,
        target: { kind: "sectionContent", sectionId: cover.id, field: "greetingBody" },
      });
    }
  }

  // Personal note.
  const note = proposal.sections.find((s) => s.type === "personalNote");
  if (note) {
    const body = (note.content?.body as string | undefined) ?? "";
    if (body.trim()) {
      out.push({
        key: `section:${note.id}:body`,
        text: body,
        target: { kind: "sectionContent", sectionId: note.id, field: "body" },
      });
    }
    const signOffLead = (note.content?.signOffLead as string | undefined) ?? "";
    if (signOffLead.trim()) {
      out.push({
        key: `section:${note.id}:signOffLead`,
        text: signOffLead,
        target: { kind: "sectionContent", sectionId: note.id, field: "signOffLead" },
      });
    }
  }

  // Days — description + subtitle.
  for (const d of proposal.days) {
    if (d.description?.trim()) {
      out.push({
        key: `day:${d.id}:description`,
        text: d.description,
        target: { kind: "day", dayId: d.id, field: "description" },
      });
    }
    if (d.subtitle?.trim()) {
      out.push({
        key: `day:${d.id}:subtitle`,
        text: d.subtitle,
        target: { kind: "day", dayId: d.id, field: "subtitle" },
      });
    }
  }

  // Properties — description, whyWeChoseThis, shortDesc.
  for (const p of proposal.properties) {
    if (p.description?.trim()) {
      out.push({
        key: `property:${p.id}:description`,
        text: p.description,
        target: { kind: "property", propertyId: p.id, field: "description" },
      });
    }
    if (p.whyWeChoseThis?.trim()) {
      out.push({
        key: `property:${p.id}:whyWeChoseThis`,
        text: p.whyWeChoseThis,
        target: { kind: "property", propertyId: p.id, field: "whyWeChoseThis" },
      });
    }
    if (p.shortDesc?.trim()) {
      out.push({
        key: `property:${p.id}:shortDesc`,
        text: p.shortDesc,
        target: { kind: "property", propertyId: p.id, field: "shortDesc" },
      });
    }
  }

  // Closing — letter, headline, availability.
  const closing = proposal.sections.find((s) => s.type === "closing");
  if (closing) {
    for (const f of ["letter", "headline", "availability"] as const) {
      const v = (closing.content?.[f] as string | undefined) ?? "";
      if (v.trim()) {
        out.push({
          key: `section:${closing.id}:${f}`,
          text: v,
          target: { kind: "sectionContent", sectionId: closing.id, field: f },
        });
      }
    }
  }

  return out;
}

export function AIToneShiftDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { proposal, updateSectionContent, updateDay, updateProperty } = useProposalStore();
  const [tone, setTone] = useState<Tone>("luxury");
  const [intensity, setIntensity] = useState<Intensity>("subtle");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "working" }
    | { kind: "applied"; count: number; previous: NarrativeField[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const fields = useMemo(() => (open ? collectNarrativeFields(proposal) : []), [proposal, open]);

  if (!open || typeof window === "undefined") return null;

  const apply = async () => {
    if (state.kind === "working") return;
    setState({ kind: "working" });

    try {
      const res = await fetch("/api/ai/tone-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          intensity,
          fields: fields.map((f) => ({ key: f.key, text: f.text })),
          context: {
            tripTitle: proposal.trip.title,
            destinations: proposal.trip.destinations,
            nights: proposal.trip.nights,
            tripStyle: proposal.trip.tripStyle,
            clientName: proposal.client.guestNames,
          },
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

      // Snapshot originals BEFORE applying so Restore works.
      const previous = fields.filter((f) => byKey.has(f.key));
      let count = 0;
      for (const f of previous) {
        const next = byKey.get(f.key);
        if (!next) continue;
        applyToTarget(f.target, next, updateSectionContent, updateDay, updateProperty);
        count++;
      }
      setState({ kind: "applied", count, previous });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong. Please retry.",
      });
    }
  };

  const restore = () => {
    if (state.kind !== "applied") return;
    for (const f of state.previous) {
      applyToTarget(f.target, f.text, updateSectionContent, updateDay, updateProperty);
    }
    setState({ kind: "idle" });
  };

  return createPortal(
    <>
      <div
        onClick={state.kind === "working" ? undefined : onClose}
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
        aria-label="AI tone shift"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 540,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 64px)",
          overflow: "auto",
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.32), 0 4px 12px rgba(0,0,0,0.18)",
          border: "1px solid rgba(0,0,0,0.08)",
          zIndex: 10001,
          fontFamily: "inherit",
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && state.kind !== "working") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-black/45">
              AI Tools
            </div>
            <div className="text-[15px] font-semibold text-black/85 mt-0.5">
              Rewrite this proposal&rsquo;s tone
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={state.kind === "working"}
            className="w-7 h-7 rounded-full text-black/45 hover:bg-black/5 hover:text-black/75 transition flex items-center justify-center text-[16px] disabled:opacity-50"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="text-[12.5px] text-black/60 leading-snug">
            We&rsquo;ll rewrite every narrative field in the proposal — cover greeting, day descriptions, property notes, closing letter — keeping every fact (places, dates, prices) intact. {fields.length} {fields.length === 1 ? "field" : "fields"} will be touched.
          </div>

          {/* Tone selector */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-2">
              Target tone
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map((t) => {
                const active = tone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    disabled={state.kind === "working"}
                    className="text-left px-3 py-2.5 rounded-lg border transition disabled:opacity-50"
                    style={{
                      background: active ? "#1b3a2d" : "#ffffff",
                      borderColor: active ? "#1b3a2d" : "rgba(0,0,0,0.12)",
                      color: active ? "#ffffff" : "#101828",
                    }}
                  >
                    <div className="text-[12.5px] font-semibold">{t.label}</div>
                    <div
                      className="text-[11px] leading-snug mt-0.5"
                      style={{ color: active ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.5)" }}
                    >
                      {t.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensity */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-2">
              Intensity
            </div>
            <div className="flex gap-2">
              {(["subtle", "strong"] as Intensity[]).map((i) => {
                const active = intensity === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIntensity(i)}
                    disabled={state.kind === "working"}
                    className="flex-1 px-3 py-1.5 text-[12.5px] font-medium rounded-lg border transition disabled:opacity-50"
                    style={{
                      background: active ? "#1b3a2d" : "#ffffff",
                      borderColor: active ? "#1b3a2d" : "rgba(0,0,0,0.12)",
                      color: active ? "#ffffff" : "#101828",
                    }}
                  >
                    {i === "subtle" ? "Subtle (light touch)" : "Strong (reshape voice)"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* State messages */}
          {state.kind === "applied" && (
            <div
              className="px-3.5 py-3 rounded-lg text-[12.5px]"
              style={{ background: "rgba(45,90,64,0.08)", color: "#1b3a2d" }}
            >
              <span className="font-semibold">Applied to {state.count} {state.count === 1 ? "field" : "fields"}.</span>{" "}
              <button
                type="button"
                onClick={restore}
                className="underline hover:opacity-70 ml-1"
              >
                Restore previous
              </button>
            </div>
          )}
          {state.kind === "error" && (
            <div
              className="px-3.5 py-3 rounded-lg text-[12.5px]"
              style={{ background: "rgba(179,67,52,0.08)", color: "#b34334" }}
            >
              {state.message}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-black/6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={state.kind === "working"}
            className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-lg text-black/60 hover:bg-black/5 transition disabled:opacity-50"
          >
            {state.kind === "applied" ? "Done" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={state.kind === "working" || fields.length === 0}
            className="px-3.5 py-1.5 text-[12.5px] font-semibold rounded-lg bg-[#1b3a2d] text-white hover:bg-[#244e3c] transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {state.kind === "working" ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Rewriting…
              </>
            ) : state.kind === "applied" ? (
              "Run again"
            ) : (
              <>✦ Apply tone</>
            )}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function applyToTarget(
  target: FieldTarget,
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
