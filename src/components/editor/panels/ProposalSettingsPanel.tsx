"use client";

import { useProposalStore } from "@/store/proposalStore";
import { uploadImage } from "@/lib/uploadImage";
import { DEFAULT_TRUST_BADGES } from "@/lib/types";
import { RegenerateBar } from "./RegenerateBar";

const COMMON_DESTINATIONS = [
  "Arusha",
  "Masai Mara",
  "Amboseli",
  "Serengeti",
  "Ngorongoro",
  "Tarangire",
  "Lake Manyara",
  "Lake Nakuru",
  "Lake Naivasha",
  "Samburu",
  "Laikipia",
  "Ol Pejeta",
  "Meru",
  "Mount Kenya",
  "Nairobi",
  "Zanzibar",
  "Lamu",
  "Diani",
  "Tsavo East",
  "Tsavo West",
  "Ruaha",
  "Selous / Nyerere",
  "Bwindi",
  "Murchison Falls",
  "Volcanoes (Rwanda)",
];

export function ProposalSettingsPanel() {
  const { proposal, updateClient, updateOperator, updateTrip, updateDepositConfig, updateTierLabel, toggleTierVisibility, setActiveTier } = useProposalStore();
  const { client, operator, trip, visibleTiers, pricing, activeTier } = proposal;
  const deposit = proposal.depositConfig ?? { enabled: false, amount: "", currency: "USD", description: "", termsUrl: "" };

  const adults = client.adults ?? 2;
  const children = client.children ?? 0;
  const totalGuests = adults + children;

  const applyAdults = (v: number) => {
    const n = clampInt(v, 1, 20);
    updateClient({ adults: n, pax: formatPax(n, children) });
  };
  const applyChildren = (v: number) => {
    const n = clampInt(v, 0, 20);
    updateClient({ children: n, pax: formatPax(adults, n) });
  };
  const applyDates = (arrival: string, departure: string) => {
    const arr = arrival || undefined;
    const dep = departure || undefined;
    const n = arr && dep ? computeNights(arr, dep) : trip.nights;
    updateTrip({
      arrivalDate: arr,
      departureDate: dep,
      nights: n,
      dates: arr && dep ? formatDateRange(arr, dep) : trip.dates,
    });
  };

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

  const toggleDestination = (d: string) => {
    const list = trip.destinations ?? [];
    const next = list.includes(d) ? list.filter((x) => x !== d) : [...list, d];
    updateTrip({ destinations: next });
  };

  return (
    <div className="space-y-6">
      {/* Regenerate buttons — top of the Trip tab */}
      <RegenerateBar />

      {/* Trip — the essentials that used to live in the top chip strip */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Trip</div>
        <div className="space-y-2.5">
          {field("Proposal title", trip.title, (v) => updateTrip({ title: v }))}
          {field("Subtitle", trip.subtitle, (v) => updateTrip({ subtitle: v }))}

          {/* Arrival / Departure — structured so nights derive automatically */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[11px] text-black/40 mb-1">Arrival</span>
              <input
                type="date"
                value={trip.arrivalDate ?? ""}
                onChange={(e) => applyDates(e.target.value, trip.departureDate ?? "")}
                className="w-full border border-black/12 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1b3a2d]"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] text-black/40 mb-1">Departure</span>
              <input
                type="date"
                value={trip.departureDate ?? ""}
                min={trip.arrivalDate || undefined}
                onChange={(e) => applyDates(trip.arrivalDate ?? "", e.target.value)}
                className="w-full border border-black/12 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1b3a2d]"
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-[11px] text-black/45 -mt-1 px-0.5">
            <span>{trip.nights ? `${trip.nights} night${trip.nights === 1 ? "" : "s"}` : "Set arrival + departure"}</span>
            {trip.dates && <span className="text-black/35 truncate max-w-[160px]" title={trip.dates}>{trip.dates}</span>}
          </div>

          {field("Trip style", trip.tripStyle ?? "", (v) => updateTrip({ tripStyle: v }), "e.g. Luxury family safari")}

          {/* Destinations — chip picker. Drives autopilot's day-by-day
              generation, so changes here matter for "Add new info". */}
          <div>
            <label className="block text-[11px] text-black/40 mb-1.5">Destinations</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_DESTINATIONS.map((d) => {
                const on = (trip.destinations ?? []).includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDestination(d)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                      on
                        ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
                        : "bg-white text-black/55 border-black/12 hover:border-black/30"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {(trip.destinations ?? []).filter(
              (d) => !COMMON_DESTINATIONS.includes(d),
            ).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(trip.destinations ?? [])
                  .filter((d) => !COMMON_DESTINATIONS.includes(d))
                  .map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDestination(d)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-[#1b3a2d] text-white border border-[#1b3a2d]"
                    >
                      {d} ×
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Operator note — free-form prompt that flavors autopilot
              (occasion, special requests, deal-breakers). */}
          <div>
            <label className="block text-[11px] text-black/40 mb-1">Notes for autopilot</label>
            <textarea
              value={trip.operatorNote ?? ""}
              onChange={(e) => updateTrip({ operatorNote: e.target.value })}
              placeholder="e.g. honeymoon, vegetarian, prefers tented camps, no early starts…"
              rows={3}
              className="w-full border border-black/12 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1b3a2d] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Client */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Client</div>
        <div className="space-y-2.5">
          {field("Guest names", client.guestNames, (v) => updateClient({ guestNames: v }), "The Anderson Family")}

          {/* Adults + Children — structured, drive the pax string */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[11px] text-black/40 mb-1">Adults</span>
              <input
                type="number"
                min={1}
                max={20}
                value={adults}
                onChange={(e) => applyAdults(parseInt(e.target.value, 10) || 1)}
                className="w-full border border-black/12 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1b3a2d] tabular-nums"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] text-black/40 mb-1">Children</span>
              <input
                type="number"
                min={0}
                max={20}
                value={children}
                onChange={(e) => applyChildren(parseInt(e.target.value, 10) || 0)}
                className="w-full border border-black/12 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1b3a2d] tabular-nums"
              />
            </label>
          </div>
          <div className="text-[11px] text-black/45 -mt-1 px-0.5">
            {totalGuests} guest{totalGuests === 1 ? "" : "s"} — pax reads “{client.pax || formatPax(adults, children)}”
          </div>

          {field("Origin", client.origin ?? "", (v) => updateClient({ origin: v }), "e.g. United Kingdom")}
          {field("Email", client.email ?? "", (v) => updateClient({ email: v }))}
          {field("Rooming", client.rooming ?? "", (v) => updateClient({ rooming: v }))}
          {field("Arrival flight", client.arrivalFlight ?? "", (v) => updateClient({ arrivalFlight: v }))}
          {field("Departure flight", client.departureFlight ?? "", (v) => updateClient({ departureFlight: v }))}
          {field("Dietary", client.dietary ?? "", (v) => updateClient({ dietary: v }))}
          {field("Special occasion", client.specialOccasion ?? "", (v) => updateClient({ specialOccasion: v }))}
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
          {/* Logo upload */}
          <div>
            <label className="block text-[11px] text-black/40 mb-1">Logo</label>
            <div className="flex items-center gap-2">
              {operator.logoUrl ? (
                <div className="flex items-center gap-2">
                  <img src={operator.logoUrl} alt="Logo" className="h-8 object-contain rounded border border-black/10 px-2 py-1 bg-white" />
                  <button onClick={() => updateOperator({ logoUrl: "" })}
                    className="text-[10px] text-red-400 hover:text-red-600 transition">Remove</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-black/15 cursor-pointer hover:bg-black/3 text-[11px] text-black/40 transition">
                  <input type="file" accept="image/*,.svg" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await uploadImage(file, { maxDimension: 800 });
                        updateOperator({ logoUrl: dataUrl });
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Logo upload failed");
                      }
                    }} />
                  + Upload logo
                </label>
              )}
            </div>
            {/* URL paste fallback */}
            {!operator.logoUrl && (
              <input
                placeholder="or paste image URL"
                className="w-full border border-black/8 rounded-lg px-3 py-1.5 text-xs bg-white/50 focus:outline-none focus:border-[#1b3a2d] mt-1.5"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v) updateOperator({ logoUrl: v });
                }}
              />
            )}
          </div>
          {field("Company name", operator.companyName, (v) => updateOperator({ companyName: v }))}
          {field("Consultant name", operator.consultantName, (v) => updateOperator({ consultantName: v }))}
          {field("Role title", operator.consultantRole ?? "", (v) => updateOperator({ consultantRole: v }), "e.g. Founder · Safari Specialist")}
          {field("Email", operator.email, (v) => updateOperator({ email: v }))}
          {field("Phone", operator.phone, (v) => updateOperator({ phone: v }))}
          {field("WhatsApp", operator.whatsapp ?? "", (v) => updateOperator({ whatsapp: v }))}
          {field("Website", operator.website ?? "", (v) => updateOperator({ website: v }))}
          {field("Booking URL", operator.bookingUrl ?? "", (v) => updateOperator({ bookingUrl: v }), "https://book.yourcompany.com")}

          {/* Trust badges — single-line bullets shown in the closing
              booking-recap variant. Configured once on the operator,
              re-used across every proposal. */}
          <div>
            <label className="block text-[11px] text-black/40 mb-1">Trust badges</label>
            <div className="text-[10.5px] text-black/40 mb-2 leading-relaxed">
              One short line each. Used by the closing booking-recap layout.
            </div>
            <TrustBadgesEditor
              value={operator.trustBadges ?? DEFAULT_TRUST_BADGES}
              onChange={(next) => updateOperator({ trustBadges: next })}
            />
          </div>
        </div>
      </div>

      {/* Deposits — optional pay button on the share view */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">Deposits</div>
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={deposit.enabled}
            onChange={(e) => updateDepositConfig({ enabled: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-black/75">Accept deposit payments on the share view</span>
        </label>
        {deposit.enabled && (
          <div className="space-y-2.5 pl-6 border-l-2" style={{ borderColor: "rgba(201,168,76,0.4)" }}>
            {field("Amount", deposit.amount, (v) => updateDepositConfig({ amount: v }), "500")}
            {field("Currency", deposit.currency, (v) => updateDepositConfig({ currency: v || "USD" }), "USD")}
            {field("Description", deposit.description ?? "", (v) => updateDepositConfig({ description: v }), "Secure your booking — 30% deposit, refundable until…")}
            {field("Terms URL (optional)", deposit.termsUrl ?? "", (v) => updateDepositConfig({ termsUrl: v }), "https://…")}
            <div className="text-[11px] text-black/45 leading-relaxed pt-1">
              Paid via Paystack — card, M-Pesa, bank transfer. Payments
              flow to your merchant account; we never touch the money.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Local helpers ─────────────────────────────────────────────────────────

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function computeNights(arrISO: string, depISO: string): number {
  const a = new Date(arrISO);
  const d = new Date(depISO);
  if (isNaN(a.getTime()) || isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((d.getTime() - a.getTime()) / 86400000));
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
  }
  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatPax(adults: number, children: number): string {
  if (children > 0) return `${adults} adults · ${children} children`;
  return `${adults} ${adults === 1 ? "adult" : "adults"}`;
}

// ─── Trust badges editor ──────────────────────────────────────────────────

function TrustBadgesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const update = (i: number, v: string) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, ""]);

  return (
    <div className="space-y-1.5">
      {value.map((badge, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={badge}
            onChange={(e) => update(i, e.target.value)}
            onBlur={(e) => {
              if (!e.target.value.trim()) remove(i);
            }}
            placeholder="e.g. Fully refundable up to 60 days"
            className="flex-1 border border-black/12 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#1b3a2d]"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-6 h-6 rounded text-black/30 hover:text-red-500 hover:bg-red-50 transition text-[14px] leading-none"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[11px] text-black/45 hover:text-[#1b3a2d] transition pt-0.5"
      >
        + Add badge
      </button>
    </div>
  );
}
