"use client";

import { useState } from "react";
import { Chip, Field, Radio, TextInput } from "./Field";
import { STYLE_BIAS, TIER_BIAS } from "@/lib/brandDNA";
import type { BrandDNAForm, PropertyPrefRow } from "./types";

export function PropertyPreferencesTab({
  form,
  update,
  prefs,
  setPrefs,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
  prefs: PropertyPrefRow[];
  setPrefs: (prefs: PropertyPrefRow[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ kind: "preferred" | "avoided"; location: string; propertyName: string; notes: string }>(
    { kind: "preferred", location: "", propertyName: "", notes: "" },
  );

  const addProperty = async () => {
    if (busy) return;
    if (!draft.propertyName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-dna/property-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: draft.kind,
          propertyName: draft.propertyName.trim(),
          location: draft.location.trim() || undefined,
          notes: draft.notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPrefs([...prefs, data.entry]);
      setDraft({ kind: draft.kind, location: "", propertyName: "", notes: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add property");
    } finally {
      setBusy(false);
    }
  };

  const removeProperty = async (id: string) => {
    const prev = prefs;
    setPrefs(prefs.filter((p) => p.id !== id));
    const res = await fetch(`/api/brand-dna/property-preferences/${id}`, { method: "DELETE" });
    if (!res.ok) setPrefs(prev); // rollback
  };

  const toggleStyle = (id: string) => {
    const has = form.styleBias.includes(id);
    update({
      styleBias: has ? form.styleBias.filter((x) => x !== id) : [...form.styleBias, id],
    });
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold text-black/85 tracking-tight">
          Property preferences
        </h2>
        <p className="mt-1.5 text-[14px] text-black/55 max-w-2xl leading-relaxed">
          Tell us which camps and lodges you sell (or avoid), your tier bias,
          and the trip styles you build. We rank selection from here so the AI
          doesn&apos;t guess.
        </p>
      </div>

      {/* Tier bias */}
      <section>
        <div className="text-[14px] font-semibold text-black/75 mb-3">Tier bias</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {TIER_BIAS.map((t) => (
            <Radio
              key={t.id}
              active={form.tierBias === t.id}
              onClick={() => update({ tierBias: form.tierBias === t.id ? "" : t.id })}
              hint={HINTS[t.id]}
            >
              {t.label}
            </Radio>
          ))}
        </div>
      </section>

      {/* Style bias */}
      <section>
        <div className="text-[14px] font-semibold text-black/75 mb-3">Typical trip styles</div>
        <div className="flex flex-wrap gap-2">
          {STYLE_BIAS.map((s) => (
            <Chip
              key={s.id}
              active={form.styleBias.includes(s.id)}
              onClick={() => toggleStyle(s.id)}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </section>

      {/* Preferred / avoided properties */}
      <section>
        <div className="text-[14px] font-semibold text-black/75 mb-3">
          Preferred &amp; avoided properties
        </div>

        {/* Existing list */}
        {prefs.length > 0 && (
          <ul className="rounded-xl border border-black/8 bg-white divide-y divide-black/8 mb-4">
            {prefs.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-start gap-3">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide shrink-0 mt-0.5"
                  style={
                    p.kind === "preferred"
                      ? { background: "rgba(45,90,64,0.15)", color: "#1b3a2d" }
                      : { background: "rgba(179,67,52,0.12)", color: "#b34334" }
                  }
                >
                  {p.kind === "preferred" ? "Preferred" : "Avoid"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-black/85 truncate">
                    {p.propertyName}
                  </div>
                  <div className="text-[12px] text-black/45 flex items-center gap-1.5 flex-wrap">
                    {p.location && <span>{p.location}</span>}
                    {p.location && p.notes && <span>·</span>}
                    {p.notes && <span className="truncate">{p.notes}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeProperty(p.id)}
                  className="text-black/30 hover:text-[#b34334] text-lg leading-none shrink-0"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add form */}
        <div className="rounded-xl border border-black/8 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            {(["preferred", "avoided"] as const).map((k) => (
              <Chip
                key={k}
                active={draft.kind === k}
                onClick={() => setDraft({ ...draft, kind: k })}
              >
                {k === "preferred" ? "Preferred" : "Avoid"}
              </Chip>
            ))}
          </div>
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
            <Field label="Property name">
              <TextInput
                value={draft.propertyName}
                onChange={(v) => setDraft({ ...draft, propertyName: v })}
                placeholder="Governors' Camp"
              />
            </Field>
            <Field label="Location (optional)">
              <TextInput
                value={draft.location}
                onChange={(v) => setDraft({ ...draft, location: v })}
                placeholder="Masai Mara"
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                onClick={addProperty}
                disabled={busy || !draft.propertyName.trim()}
                className="px-4 py-2 rounded-lg bg-[#1b3a2d] text-white text-sm font-medium hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-50 h-[34px]"
              >
                {busy ? "…" : "Add"}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <Field label="Notes (optional)">
              <TextInput
                value={draft.notes}
                onChange={(v) => setDraft({ ...draft, notes: v })}
                placeholder="Family suites only · July–October"
              />
            </Field>
          </div>
          {error && <div className="mt-2 text-[12px] text-[#b34334]">{error}</div>}
        </div>
      </section>
    </div>
  );
}

const HINTS: Record<string, string> = {
  luxury: "Pitch the best camp first; offer downgrades by request.",
  mid_range: "Balance experience with price; upsell where it matters.",
  value: "Optimise for value; highlight premium add-ons.",
};
