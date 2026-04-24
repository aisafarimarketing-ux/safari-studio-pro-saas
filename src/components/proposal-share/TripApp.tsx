"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Day, Property, Proposal, TierKey } from "@/lib/types";

// ─── TripApp ────────────────────────────────────────────────────────────────
//
// Mobile-first traveler companion. Four tabs — Today, Days, Camps, Info —
// each designed to be readable at arm's length, one-handed, in bright
// sun. Bigger type than the magazine proposal view; card-based; no
// decorative chrome.
//
// State is minimal: just the active tab. Everything else derives from
// the hydrated Proposal.

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";

type Tab = "today" | "days" | "camps" | "info";

export function TripApp({ id, proposal }: { id: string; proposal: Proposal }) {
  const [tab, setTab] = useState<Tab>("today");

  const activeTier: TierKey = proposal.activeTier;
  const today = useMemo(() => resolveToday(proposal), [proposal]);
  const tripTitle = proposal.trip.title || proposal.metadata.title || "Your safari";

  return (
    <div className="min-h-screen" style={{ background: "#f8f5ef", color: "#1a1a1a" }}>
      <Header tripTitle={tripTitle} proposalId={id} />

      <main className="max-w-xl mx-auto px-4 pb-28">
        {tab === "today" && <TodayTab proposal={proposal} activeTier={activeTier} today={today} />}
        {tab === "days" && <DaysTab proposal={proposal} activeTier={activeTier} today={today} />}
        {tab === "camps" && <CampsTab proposal={proposal} />}
        {tab === "info" && <InfoTab proposal={proposal} />}
      </main>

      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header({ tripTitle, proposalId }: { tripTitle: string; proposalId: string }) {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{
        background: "rgba(248,245,239,0.92)",
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link
          href={`/p/${proposalId}`}
          className="text-[12px] text-black/50 hover:text-black/80 transition"
        >
          ← Full proposal
        </Link>
        <div
          className="text-[13px] font-semibold truncate"
          style={{ color: FOREST }}
        >
          {tripTitle}
        </div>
        <div className="w-16" />
      </div>
    </header>
  );
}

// ─── Tab bar (bottom, thumb-zone) ──────────────────────────────────────────

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; glyph: string }[] = [
    { id: "today", label: "Today", glyph: "☀" },
    { id: "days", label: "Days", glyph: "❯" },
    { id: "camps", label: "Camps", glyph: "⌂" },
    { id: "info", label: "Info", glyph: "ⓘ" },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="max-w-xl mx-auto flex">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center py-3 transition"
              style={{ color: active ? FOREST : "rgba(0,0,0,0.45)" }}
            >
              <div className="text-[16px] leading-none">{t.glyph}</div>
              <div
                className="mt-1 text-[10.5px] uppercase tracking-[0.12em] font-semibold"
              >
                {t.label}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Today ─────────────────────────────────────────────────────────────────

function TodayTab({
  proposal,
  activeTier,
  today,
}: {
  proposal: Proposal;
  activeTier: TierKey;
  today: { dayIndex: number; relation: "before" | "today" | "after" } | null;
}) {
  if (!today) {
    // No arrival date set — show Day 1 as a sensible default.
    const day = proposal.days[0];
    if (!day) return <EmptyCard message="No days in this itinerary yet." />;
    return (
      <div className="pt-4 space-y-4">
        <Banner tone="neutral">
          Travel dates aren&apos;t set yet. Showing <strong>Day 1</strong> as a
          preview.
        </Banner>
        <DayCardFull day={day} proposal={proposal} activeTier={activeTier} />
      </div>
    );
  }

  const day = proposal.days[today.dayIndex];
  if (!day) return <EmptyCard message="Trip is between days — enjoy the journey." />;

  return (
    <div className="pt-4 space-y-4">
      {today.relation === "before" && (
        <Banner tone="gold">
          Trip begins in {daysFromNow(proposal.trip.arrivalDate)}. Here&apos;s{" "}
          <strong>Day 1</strong>.
        </Banner>
      )}
      {today.relation === "today" && (
        <Banner tone="forest">
          Today — <strong>Day {day.dayNumber}</strong>
        </Banner>
      )}
      {today.relation === "after" && (
        <Banner tone="neutral">
          Welcome home. This was your last full day.
        </Banner>
      )}
      <DayCardFull day={day} proposal={proposal} activeTier={activeTier} />
    </div>
  );
}

// ─── Days ──────────────────────────────────────────────────────────────────

function DaysTab({
  proposal,
  activeTier,
  today,
}: {
  proposal: Proposal;
  activeTier: TierKey;
  today: { dayIndex: number } | null;
}) {
  return (
    <div className="pt-4 space-y-2">
      {proposal.days.map((d, i) => {
        const isToday = today?.dayIndex === i;
        const camp = d.tiers[activeTier]?.camp ?? "";
        const property = resolveProperty(proposal.properties, camp);
        return (
          <div
            key={d.id}
            className="rounded-xl bg-white border p-4 flex items-center gap-3"
            style={{
              borderColor: isToday ? GOLD : "rgba(0,0,0,0.08)",
              background: isToday ? "rgba(201,168,76,0.06)" : "white",
            }}
          >
            <div
              className="w-10 text-center shrink-0"
              style={{ color: isToday ? FOREST : "rgba(0,0,0,0.45)" }}
            >
              <div className="text-[10.5px] uppercase tracking-wider font-semibold">Day</div>
              <div className="text-xl font-bold tabular-nums">{d.dayNumber}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-black/85 truncate">
                {d.destination}
              </div>
              <div className="text-[12.5px] text-black/55 truncate">
                {camp || "—"}
                {property?.location && camp ? ` · ${property.location}` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Camps ─────────────────────────────────────────────────────────────────

function CampsTab({ proposal }: { proposal: Proposal }) {
  if (proposal.properties.length === 0) {
    return <div className="pt-6 text-center text-black/50 text-sm">No camps added to this trip yet.</div>;
  }
  return (
    <div className="pt-4 space-y-3">
      {proposal.properties.map((p) => (
        <div
          key={p.id}
          className="rounded-xl bg-white border overflow-hidden"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          {p.leadImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.leadImageUrl}
              alt={p.name}
              className="w-full aspect-[5/3] object-cover"
            />
          )}
          <div className="p-4">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-black/40">
              {p.location}
            </div>
            <div
              className="mt-1 text-[17px] font-bold text-black/85"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {p.name}
            </div>
            {p.shortDesc && (
              <p className="mt-2 text-[13px] text-black/60 leading-relaxed">{p.shortDesc}</p>
            )}
            <div className="mt-3 text-[12px] text-black/50">
              {p.mealPlan && <span>{p.mealPlan}</span>}
              {p.mealPlan && p.nights > 0 && " · "}
              {p.nights > 0 && <span>{p.nights} night{p.nights === 1 ? "" : "s"}</span>}
              {(p.checkInTime || p.checkOutTime) && (
                <span className="block mt-1 text-[11.5px] text-black/40">
                  {p.checkInTime && `Check-in ${p.checkInTime}`}
                  {p.checkInTime && p.checkOutTime && " · "}
                  {p.checkOutTime && `Check-out ${p.checkOutTime}`}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Info (operator contact + emergency + practical) ─────────────────────

function InfoTab({ proposal }: { proposal: Proposal }) {
  const { operator } = proposal;
  const hasOperatorContact = operator.email || operator.phone || operator.whatsapp;

  return (
    <div className="pt-4 space-y-3">
      {/* Operator contact — the "who do I call" card */}
      {hasOperatorContact && (
        <div
          className="rounded-xl border p-4"
          style={{
            background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`,
            borderColor: "rgba(201,168,76,0.25)",
            color: "white",
          }}
        >
          <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: GOLD }}>
            Your operator
          </div>
          <div
            className="mt-2 text-xl font-bold"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {operator.companyName || "Safari Studio"}
          </div>
          {operator.consultantName && (
            <div className="text-[13px] text-white/70 mt-0.5">{operator.consultantName}</div>
          )}
          <div className="mt-4 space-y-2">
            {operator.phone && (
              <a
                href={`tel:${operator.phone}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white/[0.08] text-white text-[14px] hover:bg-white/[0.12] transition"
              >
                <span className="text-white/70 text-[11.5px] uppercase tracking-wider">Call</span>
                <span className="font-medium">{operator.phone}</span>
              </a>
            )}
            {operator.whatsapp && (
              <a
                href={`https://wa.me/${operator.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white/[0.08] text-white text-[14px] hover:bg-white/[0.12] transition"
              >
                <span className="text-white/70 text-[11.5px] uppercase tracking-wider">WhatsApp</span>
                <span className="font-medium">{operator.whatsapp}</span>
              </a>
            )}
            {operator.email && (
              <a
                href={`mailto:${operator.email}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white/[0.08] text-white text-[14px] hover:bg-white/[0.12] transition"
              >
                <span className="text-white/70 text-[11.5px] uppercase tracking-wider">Email</span>
                <span className="font-medium truncate">{operator.email}</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Practical info cards from the proposal */}
      {proposal.practicalInfo.length > 0 && (
        <div
          className="rounded-xl bg-white border overflow-hidden"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div
            className="px-4 py-3 text-[10.5px] uppercase tracking-[0.22em] font-semibold border-b"
            style={{ color: FOREST, borderColor: "rgba(0,0,0,0.06)" }}
          >
            Practical info
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            {proposal.practicalInfo.map((c) => (
              <details key={c.id} className="px-4 py-3.5 group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    {c.icon && <span className="text-[16px] leading-none">{c.icon}</span>}
                    <span className="text-[14px] font-semibold text-black/80">{c.title}</span>
                  </span>
                  <span className="text-black/35 group-open:rotate-45 transition text-base leading-none">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[13px] text-black/60 leading-relaxed">
                  {c.body}
                </p>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Emergency — hardcoded per-country for now */}
      <EmergencyCard countries={deriveCountries(proposal.days)} />
    </div>
  );
}

function EmergencyCard({ countries }: { countries: string[] }) {
  const numbers = countries
    .map((c) => EMERGENCY_NUMBERS[c.toLowerCase()])
    .filter(Boolean)
    .slice(0, 3);

  if (numbers.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: "rgba(179,67,52,0.04)",
        borderColor: "rgba(179,67,52,0.25)",
      }}
    >
      <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: "#b34334" }}>
        Emergency
      </div>
      <div className="mt-2 space-y-2">
        {numbers.map((n) => (
          <div key={n.country} className="text-[13px] text-black/75">
            <div className="font-semibold">{n.country}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-black/60 mt-0.5">
              <span>Police: <a href={`tel:${n.police}`} className="underline font-medium">{n.police}</a></span>
              <span>Ambulance: <a href={`tel:${n.ambulance}`} className="underline font-medium">{n.ambulance}</a></span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11.5px] text-black/45">
        If you have travel insurance, keep their 24-hour assistance number saved too.
      </div>
    </div>
  );
}

const EMERGENCY_NUMBERS: Record<string, { country: string; police: string; ambulance: string }> = {
  kenya:      { country: "Kenya",      police: "999",   ambulance: "999" },
  tanzania:   { country: "Tanzania",   police: "112",   ambulance: "112" },
  uganda:     { country: "Uganda",     police: "999",   ambulance: "112" },
  rwanda:     { country: "Rwanda",     police: "112",   ambulance: "912" },
  ethiopia:   { country: "Ethiopia",   police: "991",   ambulance: "907" },
  "south africa": { country: "South Africa", police: "10111", ambulance: "10177" },
  botswana:   { country: "Botswana",   police: "999",   ambulance: "997" },
  namibia:    { country: "Namibia",    police: "10111", ambulance: "211111" },
  zambia:     { country: "Zambia",     police: "999",   ambulance: "991" },
  zimbabwe:   { country: "Zimbabwe",   police: "995",   ambulance: "994" },
};

// ─── Day card (large format, used on Today) ────────────────────────────────

function DayCardFull({
  day,
  proposal,
  activeTier,
}: {
  day: Day;
  proposal: Proposal;
  activeTier: TierKey;
}) {
  const camp = day.tiers[activeTier]?.camp ?? "";
  const property = resolveProperty(proposal.properties, camp);

  return (
    <div
      className="rounded-2xl bg-white border overflow-hidden"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      {day.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={day.heroImageUrl}
          alt={day.destination}
          className="w-full aspect-[5/3] object-cover"
        />
      )}
      <div className="p-4">
        <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
          Day {day.dayNumber}
          {day.country && <span className="text-black/40 font-normal"> · {day.country}</span>}
        </div>
        <h2
          className="mt-2 text-2xl font-bold text-black/85 leading-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {day.destination}
        </h2>
        {day.subtitle && (
          <div className="mt-1 text-[13px] text-black/55">{day.subtitle}</div>
        )}
        {day.description && (
          <p className="mt-3 text-[14px] text-black/70 leading-relaxed">{day.description}</p>
        )}
        {day.highlights && day.highlights.length > 0 && (
          <div className="mt-4">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-black/45 mb-2">
              Highlights
            </div>
            <ul className="space-y-1 text-[13px] text-black/70">
              {day.highlights.map((h, i) => (
                <li key={i} className="pl-3 relative">
                  <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {camp && (
          <div
            className="mt-4 pt-4 border-t"
            style={{ borderColor: "rgba(0,0,0,0.06)" }}
          >
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-black/45 mb-1">
              Tonight
            </div>
            <div className="text-[14px] font-semibold text-black/85">{camp}</div>
            {property?.location && (
              <div className="text-[12.5px] text-black/50">{property.location}</div>
            )}
            {property?.mealPlan && (
              <div className="mt-1 text-[11.5px] text-black/45">{property.mealPlan}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveProperty(properties: Property[], campName: string): Property | null {
  if (!campName) return null;
  return properties.find((p) => p.name.trim().toLowerCase() === campName.trim().toLowerCase()) ?? null;
}

function resolveToday(proposal: Proposal): { dayIndex: number; relation: "before" | "today" | "after" } | null {
  const arrival = proposal.trip.arrivalDate;
  if (!arrival) return null;
  const arrivalDate = new Date(arrival);
  if (isNaN(arrivalDate.getTime())) return null;

  const today = new Date();
  const diffDays = Math.floor((today.getTime() - arrivalDate.getTime()) / 86400000);

  if (diffDays < 0) return { dayIndex: 0, relation: "before" };
  if (diffDays >= proposal.days.length) {
    return { dayIndex: proposal.days.length - 1, relation: "after" };
  }
  return { dayIndex: diffDays, relation: "today" };
}

function daysFromNow(arrivalISO?: string): string {
  if (!arrivalISO) return "";
  const arrival = new Date(arrivalISO);
  const diff = Math.ceil((arrival.getTime() - Date.now()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1 day";
  return `${diff} days`;
}

function deriveCountries(days: Day[]): string[] {
  const set = new Set<string>();
  for (const d of days) {
    if (d.country) set.add(d.country.trim());
  }
  return Array.from(set);
}

// ─── Micro UI bits ─────────────────────────────────────────────────────────

function Banner({
  tone,
  children,
}: {
  tone: "forest" | "gold" | "neutral";
  children: React.ReactNode;
}) {
  const styles: Record<typeof tone, React.CSSProperties> = {
    forest:  { background: FOREST, color: "white" },
    gold:    { background: "rgba(201,168,76,0.12)", color: "#6b5417" },
    neutral: { background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.7)" },
  };
  return (
    <div
      className="rounded-xl px-4 py-3 text-[13.5px] leading-relaxed"
      style={styles[tone]}
    >
      {children}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="pt-16 text-center text-black/50 text-sm">{message}</div>
  );
}
