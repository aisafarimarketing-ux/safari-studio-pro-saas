"use client";

import { useCallback, useEffect, useState } from "react";
import { VisualStyleTab } from "./VisualStyleTab";
import { SectionsTab } from "./SectionsTab";
import type { BrandDNAForm } from "./types";

// ─── Master Template tab ───────────────────────────────────────────────────
//
// The brand-visual home. Two zones:
//
//   1. Master picker (top) — the company's source-of-truth proposal.
//      Set by tagging a proposal in the editor's ⋯ menu; this surface
//      shows what's currently picked + a quick "Open in editor" CTA
//      and a Remove control.
//
//   2. Advanced fallback styling (collapsible) — the legacy Visual
//      Style + Sections controls. Used only when no master is set;
//      auto-expanded in that state to make the fallback obvious.
//      Once a master IS set, this collapses by default — it's
//      strictly a fallback, the master wins.
//
// No new endpoints in this component: master data comes from
// /api/brand-dna/master-template (Phase A). Setting a master happens
// in the editor, not here, so this tab is read-mostly with a single
// destructive verb (Remove).

type MasterState =
  | { state: "loading" }
  | {
      state: "ready";
      master: { id: string; title: string } | null;
      canEdit: boolean;
    }
  | { state: "error"; message: string };

export function MasterTemplateTab({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const [data, setData] = useState<MasterState>({ state: "loading" });
  const [removing, setRemoving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-dna/master-template", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setData({
        state: "ready",
        master: body.master ?? null,
        canEdit: Boolean(body.canEdit),
      });
    } catch (err) {
      setData({
        state: "error",
        message:
          err instanceof Error
            ? err.message
            : "Couldn't load master template state.",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRemove = useCallback(async () => {
    if (removing) return;
    if (
      !confirm(
        "Remove the master template? Future proposals will fall back to the system template until a new master is set. Existing proposals stay unchanged.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      const res = await fetch("/api/brand-dna/master-template", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      console.warn("[master-template] remove failed:", err);
    } finally {
      setRemoving(false);
    }
  }, [removing, refresh]);

  const masterIsSet =
    data.state === "ready" && data.master !== null;
  // Advanced fallback section starts expanded ONLY when no master is
  // set — that's when it actually drives clones. Once a master is in
  // place, the fallback is dormant; collapse by default to reduce
  // visual noise.
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(!masterIsSet);
  useEffect(() => {
    if (data.state === "ready" && data.master !== null) {
      setAdvancedOpen(false);
    } else if (data.state === "ready" && data.master === null) {
      setAdvancedOpen(true);
    }
  }, [data]);

  return (
    <div className="space-y-8">
      {/* ── Header */}
      <div>
        <h2 className="text-lg font-semibold text-black/85 tracking-tight">
          Master template
        </h2>
        <p className="mt-1.5 text-[14px] text-black/55 max-w-2xl leading-relaxed">
          The company&rsquo;s source-of-truth proposal. New proposals clone its
          theme, sections, day layouts, and pricing structure automatically.
          Existing proposals stay untouched until an admin runs{" "}
          <em>Apply company brand</em> on each one.
        </p>
      </div>

      {/* ── Master picker */}
      {data.state === "loading" && (
        <div className="text-sm text-black/40">Loading master state…</div>
      )}
      {data.state === "error" && (
        <div className="rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-sm text-[#b34334]">
          {data.message}
        </div>
      )}
      {data.state === "ready" && (
        <>
          {data.master ? (
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(201,168,76,0.08)",
                border: "1px solid rgba(201,168,76,0.30)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span aria-hidden style={{ color: "#8a7125", fontSize: 16 }}>
                  ★
                </span>
                <span
                  className="text-[10.5px] uppercase tracking-[0.18em] font-semibold"
                  style={{ color: "#8a7125" }}
                >
                  Current master
                </span>
              </div>
              <div className="text-[17px] font-semibold text-black/85 mb-3 truncate">
                {data.master.title}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/studio?id=${encodeURIComponent(data.master.id)}`}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition"
                  style={{ background: "#1b3a2d", color: "#F7F3E8" }}
                >
                  Open in editor
                </a>
                {data.canEdit && (
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    disabled={removing}
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium border border-black/12 text-black/65 hover:bg-black/[0.04] transition disabled:opacity-50"
                  >
                    {removing ? "Removing…" : "Remove master"}
                  </button>
                )}
              </div>
              <p className="mt-3 text-[12px] text-black/55 leading-relaxed">
                Edit the master in the proposal editor — colors, fonts,
                section order, layouts. Changes affect future proposals
                only. Existing proposals are unchanged unless you apply
                brand to each one.
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-5 border border-dashed border-black/15 bg-black/[0.02]">
              <div
                className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-black/45 mb-2"
              >
                No master set
              </div>
              <p className="text-[14px] text-black/65 leading-relaxed max-w-2xl">
                Open any proposal in the editor and pick{" "}
                <strong>⋯ → Use as company brand master</strong>. From then on,
                every new proposal clones its theme, sections, and layouts.
              </p>
              {!data.canEdit && (
                <p className="text-[12px] text-black/45 leading-relaxed mt-2">
                  Only an organization owner or admin can tag a proposal as
                  master.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Advanced fallback styling ──
          The old Visual Style + Sections controls. Only drive
          appearance when no master is set; once a master exists,
          these stay as a backstop for orgs that want to tweak the
          *fallback* template without touching the master itself.
          Collapsed by default when master is set so the surface
          stays focused. */}
      <div className="border-t border-black/8 pt-6">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-2 text-[13px] font-semibold text-black/65 hover:text-black/85 transition"
          aria-expanded={advancedOpen}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              transform: advancedOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              fontSize: 11,
            }}
          >
            ▶
          </span>
          Advanced fallback styling
          {!masterIsSet && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(201,168,76,0.18)",
                color: "#8a7125",
              }}
            >
              Active
            </span>
          )}
        </button>
        <p className="mt-2 text-[12px] text-black/45 leading-relaxed max-w-2xl">
          {masterIsSet
            ? "These controls only apply when no master template is set. The master takes precedence; edits here are dormant unless you remove the master."
            : "These controls drive new-proposal styling until a master template is set. We recommend tagging a real proposal as master for tighter brand control."}
        </p>

        {advancedOpen && (
          <div className="mt-6 space-y-10 pl-1">
            <VisualStyleTab form={form} update={update} />
            <div className="border-t border-black/6" />
            <SectionsTab form={form} update={update} />
          </div>
        )}
      </div>
    </div>
  );
}
