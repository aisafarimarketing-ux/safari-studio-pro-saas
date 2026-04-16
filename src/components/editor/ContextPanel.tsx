"use client";

import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { ThemePanel } from "./panels/ThemePanel";
import { SectionPanel } from "./panels/SectionPanel";
import { ProposalSettingsPanel } from "./panels/ProposalSettingsPanel";
import type { ContextTab } from "@/store/editorStore";
import type { Day, Property } from "@/lib/types";

const TABS: { id: ContextTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "style", label: "Style" },
  { id: "layout", label: "Layout" },
  { id: "advanced", label: "Theme" },
];

// ── Day quick-editor ──────────────────────────────────────────────────────────
function DayPanel({ day }: { day: Day }) {
  const { updateDay } = useProposalStore();
  return (
    <div className="space-y-4">
      <div className="text-[11px] uppercase tracking-widest text-black/40">Day {day.dayNumber}</div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-black/50 mb-1 block">Destination</span>
          <input
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition"
            value={day.destination}
            onChange={(e) => updateDay(day.id, { destination: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-xs text-black/50 mb-1 block">Subtitle</span>
          <input
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition"
            value={day.subtitle ?? ""}
            placeholder="Optional tagline"
            onChange={(e) => updateDay(day.id, { subtitle: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-xs text-black/50 mb-1 block">Country</span>
          <input
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition"
            value={day.country}
            onChange={(e) => updateDay(day.id, { country: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-xs text-black/50 mb-1 block">Board</span>
          <input
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition"
            value={day.board}
            onChange={(e) => updateDay(day.id, { board: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-xs text-black/50 mb-1 block">Description</span>
          <textarea
            rows={5}
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition resize-none"
            value={day.description}
            onChange={(e) => updateDay(day.id, { description: e.target.value })}
          />
        </label>
      </div>

      {/* Tier accommodations */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-2">Accommodations</div>
        {(["classic", "premier", "signature"] as const).map((tier) => (
          <div key={tier} className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-black/35 mb-1">{tier}</div>
            <input
              className="w-full text-xs border border-black/10 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#1b3a2d] mb-1 transition"
              placeholder="Camp / lodge name"
              value={day.tiers[tier].camp}
              onChange={(e) => updateDay(day.id, { tiers: { ...day.tiers, [tier]: { ...day.tiers[tier], camp: e.target.value } } })}
            />
            <input
              className="w-full text-xs border border-black/10 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#1b3a2d] transition"
              placeholder="Location / note"
              value={day.tiers[tier].location}
              onChange={(e) => updateDay(day.id, { tiers: { ...day.tiers, [tier]: { ...day.tiers[tier], location: e.target.value } } })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Property quick-editor ─────────────────────────────────────────────────────
function PropertyPanel({ property }: { property: Property }) {
  const { updateProperty } = useProposalStore();
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-black/40">Property</div>

      <label className="block">
        <span className="text-xs text-black/50 mb-1 block">Name</span>
        <input
          className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition"
          value={property.name}
          onChange={(e) => updateProperty(property.id, { name: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="text-xs text-black/50 mb-1 block">Location</span>
        <input
          className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition"
          value={property.location}
          onChange={(e) => updateProperty(property.id, { location: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="text-xs text-black/50 mb-1 block">Description</span>
        <textarea
          rows={4}
          className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition resize-none"
          value={property.description}
          onChange={(e) => updateProperty(property.id, { description: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="text-xs text-black/50 mb-1 block">Why we chose this</span>
        <textarea
          rows={3}
          className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#1b3a2d] transition resize-none"
          value={property.whyWeChoseThis ?? ""}
          placeholder="Personal recommendation note…"
          onChange={(e) => updateProperty(property.id, { whyWeChoseThis: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-black/50 mb-1 block">Meal plan</span>
          <input
            className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#1b3a2d] transition"
            value={property.mealPlan ?? ""}
            onChange={(e) => updateProperty(property.id, { mealPlan: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-xs text-black/50 mb-1 block">Nights</span>
          <input
            type="number"
            className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#1b3a2d] transition"
            value={property.nights}
            onChange={(e) => updateProperty(property.id, { nights: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function ContextPanel() {
  const { selectedSectionId, selectedDayId, selectedPropertyId, contextTab, setContextTab } = useEditorStore();
  const { proposal } = useProposalStore();

  const section = proposal.sections.find((s) => s.id === selectedSectionId);
  const selectedDay = proposal.days.find((d) => d.id === selectedDayId);
  const selectedProperty = proposal.properties.find((p) => p.id === selectedPropertyId);

  // Determine panel header label
  const headerLabel = selectedDay
    ? `Day ${selectedDay.dayNumber} — ${selectedDay.destination}`
    : selectedProperty
    ? selectedProperty.name
    : section
    ? section.type.replace(/([A-Z])/g, " $1").trim()
    : "Proposal";

  return (
    <div className="w-72 border-l border-black/8 bg-[#f7f4ee] flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/8 shrink-0">
        <div className="font-semibold text-sm text-black/70 truncate">{headerLabel}</div>
        {(selectedDay || selectedProperty) && (
          <div className="text-[10px] text-black/35 mt-0.5">
            {selectedDay ? "Day card" : "Property card"} — click canvas to deselect
          </div>
        )}
      </div>

      {/* Tabs — hide when day/property is selected to keep focus */}
      {!selectedDay && !selectedProperty && (
        <div className="flex border-b border-black/8 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setContextTab(tab.id)}
              className={`flex-1 text-[11px] py-2.5 font-medium transition ${
                contextTab === tab.id
                  ? "text-[#1b3a2d] border-b-2 border-[#1b3a2d]"
                  : "text-black/40 hover:text-black/65"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Panel body */}
      <div className="flex-1 overflow-auto p-4">
        {/* Day / property quick-editor — takes priority */}
        {selectedDay && <DayPanel day={selectedDay} />}
        {selectedProperty && !selectedDay && <PropertyPanel property={selectedProperty} />}

        {/* Section panels (only when no day/property selected) */}
        {!selectedDay && !selectedProperty && (
          <>
            {contextTab === "advanced" && <ThemePanel />}
            {contextTab === "style" && <SectionPanel />}
            {contextTab === "layout" && <SectionPanel />}
            {contextTab === "content" && (
              section ? (
                <div className="space-y-4">
                  <div className="text-xs text-black/40 leading-relaxed">
                    Click any text on the canvas to edit it inline. Use the{" "}
                    <strong className="text-black/60">Layout</strong> tab to change the section variant, or{" "}
                    <strong className="text-black/60">Style</strong> to override colors.
                  </div>
                  <div className="border rounded-xl p-3.5 bg-white text-xs space-y-1.5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                    <div className="font-semibold text-black/60">
                      {TABS[0].label}: {section.type}
                    </div>
                    <div className="text-black/40">Variant: {section.layoutVariant}</div>
                    <div className="text-black/40">Visible: {section.visible ? "Yes" : "Hidden"}</div>
                  </div>
                </div>
              ) : (
                <ProposalSettingsPanel />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
