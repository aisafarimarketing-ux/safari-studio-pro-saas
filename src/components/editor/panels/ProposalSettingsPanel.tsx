"use client";

import { useProposalStore } from "@/store/proposalStore";

export function ProposalSettingsPanel() {
  const { proposal, updateClient, updateOperator, updateTrip, updateTierLabel, toggleTierVisibility, setActiveTier } = useProposalStore();
  const { client, operator, trip, visibleTiers, pricing, activeTier } = proposal;

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string
  ) => (
    <div key={label}>
      <label className="block text-[11px] text-black/40 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-black/12 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1b3a2d]"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Client */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Client</div>
        <div className="space-y-2.5">
          {field("Guest names", client.guestNames, (v) => updateClient({ guestNames: v }), "The Anderson Family")}
          {field("Pax", client.pax, (v) => updateClient({ pax: v }), "2 adults · 3 children")}
          {field("Email", client.email ?? "", (v) => updateClient({ email: v }))}
          {field("Rooming", client.rooming ?? "", (v) => updateClient({ rooming: v }))}
          {field("Arrival flight", client.arrivalFlight ?? "", (v) => updateClient({ arrivalFlight: v }))}
          {field("Departure flight", client.departureFlight ?? "", (v) => updateClient({ departureFlight: v }))}
          {field("Dietary", client.dietary ?? "", (v) => updateClient({ dietary: v }))}
          {field("Special occasion", client.specialOccasion ?? "", (v) => updateClient({ specialOccasion: v }))}
        </div>
      </div>

      {/* Trip */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Trip</div>
        <div className="space-y-2.5">
          {field("Proposal title", trip.title, (v) => updateTrip({ title: v }))}
          {field("Subtitle", trip.subtitle, (v) => updateTrip({ subtitle: v }))}
          {field("Dates", trip.dates, (v) => updateTrip({ dates: v }), "5 – 12 July 2025")}
          {field("Trip style", trip.tripStyle ?? "", (v) => updateTrip({ tripStyle: v }))}
        </div>
      </div>

      {/* Tiers */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Tiers</div>
        <div className="space-y-2.5">
          {(["classic", "premier", "signature"] as const).map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <button
                onClick={() => toggleTierVisibility(tier)}
                className={`w-9 h-5 rounded-full transition relative ${visibleTiers[tier] ? "bg-[#1b3a2d]" : "bg-black/15"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${visibleTiers[tier] ? "left-4" : "left-0.5"}`} />
              </button>
              <input
                value={pricing[tier].label}
                onChange={(e) => updateTierLabel(tier, e.target.value)}
                className="flex-1 border border-black/12 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-[#1b3a2d]"
              />
              <button
                onClick={() => setActiveTier(tier)}
                className={`text-[10px] px-2 py-1 rounded-full font-bold transition ${activeTier === tier ? "bg-[#c9a84c] text-[#1b3a2d]" : "bg-black/8 text-black/40 hover:bg-black/15"}`}
              >
                Active
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Operator */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Operator</div>
        <div className="space-y-2.5">
          {field("Company name", operator.companyName, (v) => updateOperator({ companyName: v }))}
          {field("Consultant name", operator.consultantName, (v) => updateOperator({ consultantName: v }))}
          {field("Email", operator.email, (v) => updateOperator({ email: v }))}
          {field("Phone", operator.phone, (v) => updateOperator({ phone: v }))}
          {field("WhatsApp", operator.whatsapp ?? "", (v) => updateOperator({ whatsapp: v }))}
          {field("Website", operator.website ?? "", (v) => updateOperator({ website: v }))}
        </div>
      </div>
    </div>
  );
}
