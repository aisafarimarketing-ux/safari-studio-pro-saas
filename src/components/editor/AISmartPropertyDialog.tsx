"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useProposalStore } from "@/store/proposalStore";
import type { Property as ProposalProperty } from "@/lib/types";

// ─── AISmartPropertyDialog ─────────────────────────────────────────────
//
// Smart Property Suggestions — third pillar of the AI-tools triad.
//
//   ✦ Fill blanks       — drafts narrative for empty fields
//   ✦ Tone shift        — rewrites filled fields in a target voice
//   ✦ Smart properties  — picks WHICH lodge fills which day  ← this one
//
// Operator opens this from the toolbar AI menu. We send every day
// without an assigned camp to /api/ai/suggest-properties along with
// the trip vibe and active tier. The endpoint ranks the operator's
// library per day, sends top candidates to Claude, and returns one
// pick per day with reasoning. Library-only — Claude can never invent
// a lodge.
//
// Operator sees a per-day card showing the chosen lodge + reasoning,
// can swap any pick for an alternative without rerunning the AI, and
// approves selectively. On apply we dispatch through the same code
// path as DayPropertyPicker (replace-or-add, then update day.tiers).

interface CatalogEntry {
  name: string;
  propertyClass: string | null;
  location: string | null;
  snapshot: Partial<ProposalProperty>;
}

interface SuggestPick {
  dayId: string;
  libraryPropertyId: string;
  propertyName: string;
  reasoning: string;
  snapshot: Partial<ProposalProperty>;
  alternatives: Array<{ id: string; name: string }>;
}

interface SuggestResponse {
  summary: string;
  picks: SuggestPick[];
  catalog: Record<string, CatalogEntry>;
}

export function AISmartPropertyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { proposal, addPropertyFromLibrary, updateProperty, updateDay } =
    useProposalStore();
  const [repickAll, setRepickAll] = useState(false);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | {
        kind: "ready";
        response: SuggestResponse;
        // Per-day overrides — operator-chosen propertyId for the pick.
        // Defaults to the AI's pick; can be swapped to an alternative.
        chosen: Record<string, string>;
        selected: Set<string>;
      }
    | { kind: "applying" }
    | { kind: "applied"; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (open) {
      setState({ kind: "idle" });
      setRepickAll(false);
    }
  }, [open]);

  // Pre-count: how many days have no camp assigned in the active tier.
  const emptyDayCount = (() => {
    if (!open) return 0;
    let n = 0;
    for (const d of proposal.days) {
      const camp = d.tiers?.[proposal.activeTier]?.camp;
      if (!camp?.trim()) n++;
    }
    return n;
  })();

  if (!open || typeof window === "undefined") return null;

  const run = async (repickAllFlag: boolean) => {
    setState({ kind: "loading" });
    setRepickAll(repickAllFlag);

    const payload = {
      trip: {
        title: proposal.trip.title,
        destinations: proposal.trip.destinations,
        nights: proposal.trip.nights,
        tripStyle: proposal.trip.tripStyle,
        arrivalDate: proposal.trip.arrivalDate,
      },
      client: { guestNames: proposal.client.guestNames },
      activeTier: proposal.activeTier,
      days: proposal.days.map((d) => ({
        id: d.id,
        dayNumber: d.dayNumber,
        destination: d.destination,
        country: d.country,
        subtitle: d.subtitle,
        description: d.description,
        currentCamp: d.tiers?.[proposal.activeTier]?.camp ?? "",
      })),
      repickAll: repickAllFlag,
    };

    try {
      const res = await fetch("/api/ai/suggest-properties", {
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
      const json = (await res.json()) as SuggestResponse;
      const chosen: Record<string, string> = {};
      const selected = new Set<string>();
      for (const p of json.picks) {
        chosen[p.dayId] = p.libraryPropertyId;
        selected.add(p.dayId);
      }
      setState({ kind: "ready", response: json, chosen, selected });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Couldn't generate — try again.",
      });
    }
  };

  const apply = () => {
    if (state.kind !== "ready") return;
    setState({ kind: "applying" });

    let count = 0;
    const tier = proposal.activeTier;

    for (const pick of state.response.picks) {
      if (!state.selected.has(pick.dayId)) continue;
      // Resolve which propertyId the operator finally chose for this
      // day — could be the AI's pick or an operator-swapped alternative.
      const finalPropertyId = state.chosen[pick.dayId] ?? pick.libraryPropertyId;
      const snapshot =
        finalPropertyId === pick.libraryPropertyId
          ? pick.snapshot
          : state.response.catalog[finalPropertyId]?.snapshot;
      if (!snapshot || !snapshot.name) continue;

      // Same replace-or-add logic as DayCard.onAssignProperty —
      // re-picking a property that already exists in the proposal must
      // overwrite the stored snapshot (otherwise stale autopilot images
      // resurrect on re-pick — see DayCard.onAssignProperty for the
      // incident note).
      const nameLc = snapshot.name.trim().toLowerCase();
      const existing = proposal.properties.find(
        (p) => p.name.trim().toLowerCase() === nameLc,
      );
      if (existing) {
        updateProperty(existing.id, { ...snapshot, id: existing.id });
      } else {
        addPropertyFromLibrary(snapshot);
      }

      const day = proposal.days.find((d) => d.id === pick.dayId);
      if (!day) continue;
      updateDay(day.id, {
        tiers: {
          ...day.tiers,
          [tier]: {
            ...day.tiers[tier],
            camp: snapshot.name,
            location:
              snapshot.location || day.tiers[tier].location,
            note: "",
          },
        },
      });
      count++;
    }

    setState({ kind: "applied", count });
  };

  const togglePick = (dayId: string) => {
    if (state.kind !== "ready") return;
    const next = new Set(state.selected);
    if (next.has(dayId)) next.delete(dayId);
    else next.add(dayId);
    setState({ ...state, selected: next });
  };

  const swapPick = (dayId: string, propertyId: string) => {
    if (state.kind !== "ready") return;
    setState({ ...state, chosen: { ...state.chosen, [dayId]: propertyId } });
  };

  return createPortal(
    <>
      <div
        onClick={
          state.kind === "applying" || state.kind === "loading"
            ? undefined
            : onClose
        }
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
        aria-label="AI property suggestions"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 760,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderRadius: 14,
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.32), 0 4px 12px rgba(0,0,0,0.18)",
          border: "1px solid rgba(0,0,0,0.08)",
          zIndex: 10001,
          fontFamily: "inherit",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/6 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-black/45">
              AI Tools — Smart properties
            </div>
            <div className="text-[15px] font-semibold text-black/85 mt-0.5">
              Let AI pick lodges from your library
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
                We&rsquo;ll match each day&rsquo;s destination + vibe to the best
                lodge in your library, using your Brand DNA preferences and
                the active tier ({proposal.activeTier}). Library-only — AI
                can&rsquo;t invent a lodge.
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
                      Fill empty days only
                    </div>
                    <span
                      className="text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded font-bold"
                      style={{
                        background: "rgba(45,90,64,0.10)",
                        color: "#1b3a2d",
                      }}
                    >
                      {emptyDayCount}{" "}
                      {emptyDayCount === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <div className="text-[12px] text-black/55 mt-1">
                    Only suggests lodges for days with no camp assigned.
                    Days you&rsquo;ve already picked stay as-is.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => run(true)}
                  className="w-full text-left px-4 py-3 rounded-lg border transition hover:border-[#b06a3b] hover:bg-[#b06a3b]/[0.03]"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                >
                  <div className="font-semibold text-[13px] text-black/85">
                    Repick everything
                  </div>
                  <div className="text-[12px] text-black/55 mt-1">
                    Fresh picks for every day in the {proposal.activeTier} tier.
                    You&rsquo;ll review each suggestion before anything saves.
                  </div>
                </button>
              </div>

              {emptyDayCount === 0 && (
                <div className="text-[12px] italic text-black/50">
                  Every day already has a property assigned in the{" "}
                  {proposal.activeTier} tier. Use Repick to redraft them.
                </div>
              )}
            </>
          )}

          {state.kind === "loading" && (
            <div className="flex items-center gap-3 text-[13px] text-black/55 py-8">
              <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
              <span>
                {repickAll
                  ? "Picking lodges for every day…"
                  : "Picking lodges for the empty days…"}
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
              <div
                className="text-[12.5px] mb-4"
                style={{ color: "#1b3a2d" }}
              >
                <span className="font-semibold">AI summary:</span>{" "}
                {state.kind === "ready" ? state.response.summary : ""}
              </div>
              {state.kind === "ready" && state.response.picks.length === 0 && (
                <div className="text-[13px] text-black/55 italic py-4">
                  No suggestions returned. Check your library covers these
                  destinations.
                </div>
              )}
              {state.kind === "ready" &&
                state.response.picks.map((pick) => {
                  const day = proposal.days.find((d) => d.id === pick.dayId);
                  const chosenId = state.chosen[pick.dayId] ?? pick.libraryPropertyId;
                  const chosenName =
                    chosenId === pick.libraryPropertyId
                      ? pick.propertyName
                      : state.response.catalog[chosenId]?.name ?? pick.propertyName;
                  const chosenLocation =
                    state.response.catalog[chosenId]?.location ?? "";
                  const chosenClass =
                    state.response.catalog[chosenId]?.propertyClass ?? null;
                  return (
                    <PickRow
                      key={pick.dayId}
                      dayLabel={
                        day
                          ? `Day ${day.dayNumber} · ${day.destination}`
                          : pick.dayId
                      }
                      currentCamp={day?.tiers?.[proposal.activeTier]?.camp ?? ""}
                      chosenName={chosenName}
                      chosenLocation={chosenLocation}
                      chosenClass={chosenClass}
                      reasoning={pick.reasoning}
                      alternatives={pick.alternatives}
                      isAIPick={chosenId === pick.libraryPropertyId}
                      selected={state.selected.has(pick.dayId)}
                      onToggle={() => togglePick(pick.dayId)}
                      onSwap={(propertyId) => swapPick(pick.dayId, propertyId)}
                      onRevert={() =>
                        swapPick(pick.dayId, pick.libraryPropertyId)
                      }
                    />
                  );
                })}
              {state.kind === "applying" && (
                <div className="flex items-center gap-3 text-[13px] text-black/55 py-3">
                  <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
                  <span>Assigning properties…</span>
                </div>
              )}
            </>
          )}

          {state.kind === "applied" && (
            <div
              className="px-3.5 py-3 rounded-lg text-[13px]"
              style={{ background: "rgba(45,90,64,0.08)", color: "#1b3a2d" }}
            >
              Assigned {state.count}{" "}
              {state.count === 1 ? "property" : "properties"}. Review the
              proposal — every pick is editable as usual.
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
          {state.kind === "ready" && state.response.picks.length > 0 && (
            <button
              type="button"
              onClick={apply}
              className="px-3.5 py-1.5 text-[12.5px] font-semibold rounded-lg bg-[#1b3a2d] text-white hover:bg-[#244e3c] transition inline-flex items-center gap-2"
            >
              ✦ Assign {state.selected.size}{" "}
              {state.selected.size === 1 ? "lodge" : "lodges"}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function PickRow({
  dayLabel,
  currentCamp,
  chosenName,
  chosenLocation,
  chosenClass,
  reasoning,
  alternatives,
  isAIPick,
  selected,
  onToggle,
  onSwap,
  onRevert,
}: {
  dayLabel: string;
  currentCamp: string;
  chosenName: string;
  chosenLocation: string;
  chosenClass: string | null;
  reasoning: string;
  alternatives: Array<{ id: string; name: string }>;
  isAIPick: boolean;
  selected: boolean;
  onToggle: () => void;
  onSwap: (propertyId: string) => void;
  onRevert: () => void;
}) {
  const [altOpen, setAltOpen] = useState(false);
  return (
    <div
      className="block mb-3 rounded-lg border transition"
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
            {dayLabel}
          </div>
          {currentCamp && (
            <div
              className="text-[12px] line-through mb-1"
              style={{ color: "rgba(0,0,0,0.45)" }}
            >
              {currentCamp}
            </div>
          )}
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-[14px] font-semibold text-black/90">
              {chosenName}
            </div>
            {chosenClass && (
              <div className="text-[10px] uppercase tracking-wider text-black/50">
                {chosenClass.replace(/_/g, " ")}
              </div>
            )}
            {!isAIPick && (
              <button
                type="button"
                onClick={onRevert}
                className="text-[10.5px] text-[#1b3a2d] hover:underline"
              >
                ↺ Revert to AI pick
              </button>
            )}
          </div>
          {chosenLocation && (
            <div className="text-[11.5px] text-black/55 mt-0.5">
              {chosenLocation}
            </div>
          )}
          {reasoning && isAIPick && (
            <div
              className="text-[12.5px] leading-snug mt-1.5"
              style={{ color: "rgba(0,0,0,0.72)" }}
            >
              <span aria-hidden style={{ color: "#c9a84c", marginRight: 4 }}>
                ✦
              </span>
              {reasoning}
            </div>
          )}
          {alternatives.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setAltOpen((v) => !v)}
                className="text-[11px] text-black/55 hover:text-black/80"
              >
                {altOpen ? "Hide" : "Show"} {alternatives.length}{" "}
                alternative{alternatives.length === 1 ? "" : "s"}
              </button>
              {altOpen && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {alternatives.map((alt) => (
                    <button
                      key={alt.id}
                      type="button"
                      onClick={() => {
                        onSwap(alt.id);
                        setAltOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-full text-[11.5px] border border-black/12 text-black/70 hover:border-[#1b3a2d] hover:text-[#1b3a2d] hover:bg-[#1b3a2d]/[0.04] transition"
                    >
                      {alt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
