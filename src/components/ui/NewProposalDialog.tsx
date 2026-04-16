"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { TEMPLATES } from "@/lib/defaults";
import type { QuickStartForm, TierKey } from "@/lib/types";

const BLANK_FORM: QuickStartForm = {
  guestNames: "",
  travelDates: "",
  pax: "",
  rooming: "",
  arrivalFlight: "",
  departureFlight: "",
  specialOccasion: "",
  dietary: "",
  budgetTier: "premier",
  tripStyle: "",
  destinations: "",
  highlights: "",
  operatorNote: "",
};

export function NewProposalDialog() {
  const { newProposalOpen, closeNewProposal } = useEditorStore();
  const { loadTemplate, loadBlank, createFromQuickStart } = useProposalStore();
  const [tab, setTab] = useState<"quick" | "blank" | "template">("template");
  const [form, setForm] = useState<QuickStartForm>(BLANK_FORM);

  if (!newProposalOpen) return null;

  const handleQuickStart = (e: React.FormEvent) => {
    e.preventDefault();
    createFromQuickStart(form);
    closeNewProposal();
  };

  const handleBlank = () => {
    loadBlank();
    closeNewProposal();
  };

  const handleTemplate = (id: string) => {
    loadTemplate(id);
    closeNewProposal();
  };

  const field = (
    label: string,
    key: keyof QuickStartForm,
    placeholder?: string,
    type: "text" | "textarea" | "select" = "text"
  ) => (
    <div key={key}>
      <label className="block text-xs text-black/50 mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea
          value={form[key] as string}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm bg-white resize-none min-h-[70px]"
        />
      ) : type === "select" ? (
        <select
          value={form[key] as string}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value as TierKey }))}
          className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="classic">Classic</option>
          <option value="premier">Premier</option>
          <option value="signature">Signature</option>
        </select>
      ) : (
        <input
          type="text"
          value={form[key] as string}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm bg-white"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeNewProposal}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-black/8 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold tracking-tight">New Proposal</h2>
          <button
            onClick={closeNewProposal}
            className="w-8 h-8 rounded-full hover:bg-black/8 flex items-center justify-center text-black/40 hover:text-black/70 transition"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-8 pt-4 shrink-0">
          {(["template", "quick", "blank"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? "bg-[#1b3a2d] text-white"
                  : "text-black/50 hover:text-black/80 hover:bg-black/5"
              }`}
            >
              {t === "template" ? "Load Template" : t === "quick" ? "Quick Start" : "Blank Canvas"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {/* Templates */}
          {tab === "template" && (
            <div className="grid grid-cols-2 gap-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTemplate(t.id)}
                  className="text-left p-5 rounded-xl border-2 border-black/8 hover:border-[#1b3a2d] hover:bg-[#f3f0ea] transition group"
                >
                  <div className="text-3xl mb-3">{t.emoji}</div>
                  <div className="font-semibold text-[15px] mb-1 group-hover:text-[#1b3a2d]">
                    {t.name}
                  </div>
                  <div className="text-sm text-black/50 leading-relaxed">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quick Start */}
          {tab === "quick" && (
            <form onSubmit={handleQuickStart} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {field("Guest full names *", "guestNames", "e.g. The Anderson Family")}
                {field("Travel dates *", "travelDates", "e.g. 5 – 12 July 2025")}
                {field("Pax", "pax", "e.g. 2 adults, 3 children")}
                {field("Rooming", "rooming", "e.g. 1 family tent + 1 double")}
                {field("Arrival flight", "arrivalFlight", "e.g. KQ 100 — 05 Jul 09:40")}
                {field("Departure flight", "departureFlight", "e.g. KQ 101 — 12 Jul 14:00")}
                {field("Special occasion", "specialOccasion", "e.g. 10th anniversary")}
                {field("Dietary requirements", "dietary", "e.g. Halal, nut allergy")}
                {field("Budget tier", "budgetTier", undefined, "select")}
                {field("Trip style", "tripStyle", "e.g. Family safari, honeymoon")}
                {field("Destinations", "destinations", "e.g. Masai Mara, Amboseli")}
              </div>
              {field("Requested highlights", "highlights", "What must this trip include?", "textarea")}
              {field("Operator note", "operatorNote", "Private notes for the proposal...", "textarea")}

              <button
                type="submit"
                className="w-full py-3 bg-[#1b3a2d] text-white rounded-xl font-semibold hover:bg-[#2d5a40] transition"
              >
                Generate Proposal
              </button>
            </form>
          )}

          {/* Blank */}
          {tab === "blank" && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">◻</div>
              <h3 className="text-lg font-semibold mb-2">Start from scratch</h3>
              <p className="text-black/50 mb-8 max-w-xs mx-auto">
                Open the editor with an empty but fully structured proposal shell. All sections are present and ready to fill.
              </p>
              <button
                onClick={handleBlank}
                className="px-8 py-3 bg-[#1b3a2d] text-white rounded-xl font-semibold hover:bg-[#2d5a40] transition"
              >
                Open Blank Canvas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
