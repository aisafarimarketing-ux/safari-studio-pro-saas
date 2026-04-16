"use client";

import { useState } from "react";
import Link from "next/link";

type FitType = "cover" | "contain";

interface DayData {
  id: string;
  dayNumber: number;
  destination: string;
  country: string;
  board: string;
  camp: string;
  campLocation: string;
  campHighlight: string;
  description: string;
  imageUrl: string | null;
  propertyImageUrl: string | null;
  destinationFit: FitType;
  propertyFit: FitType;
  tier1Camp: string;
  tier1Note: string;
  tier2Camp: string;
  tier2Note: string;
  tier3Camp: string;
  tier3Note: string;
}

interface ProposalData {
  clientName: string;
  clientEmail: string;
  pax: string;
  tripTitle: string;
  tripSubtitle: string;
  dates: string;
  totalNights: string;
  consultantName: string;
  consultantEmail: string;
  summary: string;
  tier1Label: string;
  tier2Label: string;
  tier3Label: string;
  tier1PricePerPerson: string;
  tier2PricePerPerson: string;
  tier3PricePerPerson: string;
  currency: string;
  inclusions: string;
  exclusions: string;
  days: DayData[];
}

const DEFAULT_PROPOSAL: ProposalData = {
  clientName: "The Anderson Family",
  clientEmail: "anderson.family@outlook.com",
  pax: "2 adults · 3 children (ages 8, 11, 14)",
  tripTitle: "Anderson Family Safari",
  tripSubtitle: "7 Days · Kenya & Tanzania · July 2025",
  dates: "5 – 12 July 2025",
  totalNights: "7 nights",
  consultantName: "Amina Oduya",
  consultantEmail: "amina@safaristudio.co",
  summary:
    "A thoughtfully designed family safari across two of East Africa's most iconic landscapes — the sweeping Masai Mara and the elephant plains of Amboseli. Every element has been chosen to work beautifully for a family of five: camps with family tents or private villas, child-friendly guides, and a pace that leaves room for wonder without exhausting anyone. This is the kind of trip children remember for the rest of their lives.",
  tier1Label: "Classic",
  tier2Label: "Premier",
  tier3Label: "Signature",
  tier1PricePerPerson: "4,850",
  tier2PricePerPerson: "7,200",
  tier3PricePerPerson: "11,400",
  currency: "USD",
  inclusions:
    "All game drives · Full board accommodation · Park fees · Airstrip transfers · Flying doctors emergency cover",
  exclusions:
    "International flights · Kenya/Tanzania visa fees · Travel insurance · Personal spending",
  days: [
    {
      id: "day1",
      dayNumber: 1,
      destination: "Nairobi",
      country: "Kenya",
      board: "Dinner only",
      camp: "The Emakoko",
      campLocation: "Nairobi National Park",
      campHighlight: "Game viewing from day one, minutes from the airport",
      description:
        "Your East African adventure begins in Nairobi. After a warm welcome at the airstrip, transfer directly into the Nairobi National Park corridor where The Emakoko sits on the edge of the park's gorge. Your afternoon briefing sets the tone: relaxed, expert and entirely focused on the family experience ahead. Sundowners on the deck with distant city lights is a disarmingly good start.",
      imageUrl: null,
      propertyImageUrl: null,
      destinationFit: "cover",
      propertyFit: "cover",
      tier1Camp: "The Emakoko",
      tier1Note: "Stunning gorge-edge setting · family rooms available",
      tier2Camp: "The Emakoko",
      tier2Note: "Stunning gorge-edge setting · family rooms available",
      tier3Camp: "Hemingways Nairobi",
      tier3Note: "Award-winning boutique hotel · Karen suburb",
    },
    {
      id: "day2",
      dayNumber: 2,
      destination: "Masai Mara",
      country: "Kenya",
      board: "Full board",
      camp: "Governors' Camp",
      campLocation: "Central Mara · riverside",
      campHighlight: "Classic camp · exceptional family guiding",
      description:
        "A scenic morning flight deposits you into the heart of the Masai Mara. The grass is long and gold in July, the air sharp and clean. Your guide meets you at the airstrip and the afternoon game drive begins almost immediately — expect lion sightings to feel inevitable rather than lucky. Governors' Camp sits right on the Mara River, and the sound of hippos through canvas is something the children will tell their friends about.",
      imageUrl: null,
      propertyImageUrl: null,
      destinationFit: "cover",
      propertyFit: "cover",
      tier1Camp: "Governors' Camp",
      tier1Note: "Classic canvas · Mara River setting",
      tier2Camp: "Little Governors' Camp",
      tier2Note: "Exclusive island setting · boat transfer to camp",
      tier3Camp: "Angama Mara",
      tier3Note: "Clifftop infinity views · private family villa available",
    },
    {
      id: "day3",
      dayNumber: 3,
      destination: "Masai Mara",
      country: "Kenya",
      board: "Full board",
      camp: "Governors' Camp",
      campLocation: "Central Mara · riverside",
      campHighlight: "Full day game drives · Great Migration plains",
      description:
        "A full day in the Mara — arguably the finest wildlife day available anywhere in Africa in July. The Wildebeest Migration is in full swing, stretching across the plains in columns that disappear into the horizon. Morning and afternoon game drives are bookended by an exceptional lunch back at camp. This is the day the family will reference as the highlight for years to come.",
      imageUrl: null,
      propertyImageUrl: null,
      destinationFit: "cover",
      propertyFit: "cover",
      tier1Camp: "Governors' Camp",
      tier1Note: "Classic canvas · Mara River setting",
      tier2Camp: "Little Governors' Camp",
      tier2Note: "Exclusive island setting · full-day drive included",
      tier3Camp: "Angama Mara",
      tier3Note: "Private vehicle · fully flexible driving day",
    },
    {
      id: "day4",
      dayNumber: 4,
      destination: "Amboseli",
      country: "Kenya",
      board: "Full board",
      camp: "Tortilis Camp",
      campLocation: "Amboseli · Mt Kilimanjaro views",
      campHighlight: "World's best elephant population · Kili backdrop",
      description:
        "A short scenic flight connects the Mara to Amboseli, a completely different world. Where the Mara is drama and movement, Amboseli is stillness and scale. Kilimanjaro dominates the southern horizon, and the elephant herds here are the most relaxed and well-studied in Africa. Afternoon arrival gives time to settle in and take a first look at the mountain before dinner under the stars.",
      imageUrl: null,
      propertyImageUrl: null,
      destinationFit: "cover",
      propertyFit: "cover",
      tier1Camp: "Ol Tukai Lodge",
      tier1Note: "Good value · central location · family rooms",
      tier2Camp: "Tortilis Camp",
      tier2Note: "Thorn-tree canopy · elegant family tents",
      tier3Camp: "Amboseli Serena Safari Lodge",
      tier3Note: "Lake views · expansive pool · premium guiding",
    },
    {
      id: "day5",
      dayNumber: 5,
      destination: "Amboseli",
      country: "Kenya",
      board: "Full board",
      camp: "Tortilis Camp",
      campLocation: "Amboseli · Mt Kilimanjaro views",
      campHighlight: "Elephant encounters · photography · Maasai village",
      description:
        "The second Amboseli day brings depth. An early morning drive through the swamp edges when Kilimanjaro is sharp and pink in the dawn light is extraordinary — and surprisingly achievable with children when they're sleeping well. An optional Maasai village visit in the late morning adds a cultural layer that the older children especially will find fascinating. Afternoons are gentle: pool, wildlife talks, star beds.",
      imageUrl: null,
      propertyImageUrl: null,
      destinationFit: "cover",
      propertyFit: "cover",
      tier1Camp: "Ol Tukai Lodge",
      tier1Note: "Good value · central location · family rooms",
      tier2Camp: "Tortilis Camp",
      tier2Note: "Thorn-tree canopy · elegant family tents",
      tier3Camp: "Amboseli Serena Safari Lodge",
      tier3Note: "Lake views · expansive pool · premium guiding",
    },
    {
      id: "day6",
      dayNumber: 6,
      destination: "Tsavo East",
      country: "Kenya",
      board: "Full board",
      camp: "Ashnil Aruba Lodge",
      campLocation: "Tsavo East · Aruba Dam",
      campHighlight: "Red elephants · dramatic scenery · fewer crowds",
      description:
        "The road less travelled. Tsavo East is one of Kenya's oldest and largest parks, and the Aruba Dam acts as a permanent wildlife magnet — a guaranteed game-viewing hotspot that never disappoints. The red dust elephants are Tsavo's signature, and the family will be the only ones out there. A long afternoon drive following the Galana River is a quietly perfect way to end the last full safari day.",
      imageUrl: null,
      propertyImageUrl: null,
      destinationFit: "cover",
      propertyFit: "cover",
      tier1Camp: "Ashnil Aruba Lodge",
      tier1Note: "Dam-edge setting · reliable game viewing",
      tier2Camp: "Satao Camp",
      tier2Note: "Waterhole camp · classic Tsavo feel",
      tier3Camp: "Finch Hattons",
      tier3Note: "Legendary luxury · private plunge pools · exceptional cuisine",
    },
    {
      id: "day7",
      dayNumber: 7,
      destination: "Nairobi",
      country: "Kenya",
      board: "Breakfast only",
      camp: "Departure",
      campLocation: "JKIA · Nairobi",
      campHighlight: "Final morning game drive before fly-out",
      description:
        "One final early morning drive — a last chance to let Africa settle into the memory. After a relaxed camp breakfast the family transfers to the Tsavo East airstrip for the scenic flight back to Nairobi's Wilson Airport, connecting to JKIA for international departures. Bags are light but memories are not: the Great Migration, red elephants, Kilimanjaro at dawn, and the whole canvas spread before you.",
      imageUrl: null,
      propertyImageUrl: null,
      destinationFit: "cover",
      propertyFit: "cover",
      tier1Camp: "Charter flight",
      tier1Note: "Tsavo East → Wilson Airport",
      tier2Camp: "Charter flight",
      tier2Note: "Tsavo East → Wilson Airport",
      tier3Camp: "Private charter",
      tier3Note: "Direct Tsavo → JKIA available on request",
    },
  ],
};

function DayCard({
  day,
  tierLabels,
  visibleTiers,
  onUpdate,
}: {
  day: DayData;
  tierLabels: { tier1: string; tier2: string; tier3: string };
  visibleTiers: { tier1: boolean; tier2: boolean; tier3: boolean };
  onUpdate: (id: string, updates: Partial<DayData>) => void;
}) {
  const activeTierKey =
    (
      Object.keys(visibleTiers).find(
        (k) => visibleTiers[k as keyof typeof visibleTiers]
      ) as keyof typeof visibleTiers | undefined
    ) ?? "tier2";

  const activeTierLabel = tierLabels[activeTierKey];

  const handleDestinationImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpdate(day.id, { imageUrl: URL.createObjectURL(file) });
  };

  const handlePropertyImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpdate(day.id, { propertyImageUrl: URL.createObjectURL(file) });
  };

  return (
    <div className="bg-white border border-black/10 rounded-3xl overflow-hidden shadow-sm">
      {/* Destination image */}
      <div className="w-full h-[280px] bg-[#e8e2d7] relative">
        <label className="w-full h-full cursor-pointer flex items-center justify-center absolute inset-0">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleDestinationImage}
          />
          {!day.imageUrl ? (
            <div className="text-center">
              <div className="text-3xl mb-2">+</div>
              <div className="text-neutral-500 text-sm">
                Click to add destination photo
              </div>
            </div>
          ) : (
            <img
              src={day.imageUrl}
              alt={day.destination}
              className={`w-full h-full ${
                day.destinationFit === "cover"
                  ? "object-cover"
                  : "object-contain bg-[#e8e2d7]"
              }`}
            />
          )}
        </label>
        {/* Day badge */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-[11px] uppercase tracking-[0.22em] text-black/60 px-3 py-1 rounded-full font-semibold pointer-events-none">
          Day {day.dayNumber}
        </div>
      </div>

      {/* Lower content */}
      <div className="grid grid-cols-1 md:grid-cols-[38%_62%]">
        {/* Property image */}
        <div className="relative min-h-[260px] md:min-h-[320px] bg-[#ebe5db]">
          <label className="w-full h-full cursor-pointer flex items-center justify-center absolute inset-0">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePropertyImage}
            />
            {!day.propertyImageUrl ? (
              <div className="text-center">
                <div className="text-2xl mb-1">+</div>
                <span className="text-neutral-500 text-sm">
                  Add property photo
                </span>
              </div>
            ) : (
              <img
                src={day.propertyImageUrl}
                alt={day.camp}
                className={`w-full h-full ${
                  day.propertyFit === "cover"
                    ? "object-cover"
                    : "object-contain bg-[#ebe5db]"
                }`}
              />
            )}
          </label>

          <div className="absolute top-4 right-4 bg-amber-500 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-sm pointer-events-none">
            {activeTierLabel}
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <div className="text-white text-sm font-medium">{day.camp}</div>
            <div className="text-white/70 text-xs mt-0.5">
              {day.campLocation}
            </div>
          </div>
        </div>

        {/* Text content */}
        <div className="p-7 md:p-8 space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.22em] text-black/40">
              Day {day.dayNumber} · {day.country} · {day.board}
            </div>

            <h2
              contentEditable
              suppressContentEditableWarning
              className="text-[38px] leading-[1.04] font-serif text-black/85 outline-none"
              onBlur={(e) =>
                onUpdate(day.id, {
                  destination: e.currentTarget.textContent ?? day.destination,
                })
              }
            >
              {day.destination}
            </h2>

            <div
              contentEditable
              suppressContentEditableWarning
              className="text-sm text-black/45 outline-none"
              onBlur={(e) =>
                onUpdate(day.id, {
                  campHighlight:
                    e.currentTarget.textContent ?? day.campHighlight,
                })
              }
            >
              {day.campHighlight}
            </div>
          </div>

          <p
            contentEditable
            suppressContentEditableWarning
            className="text-[16px] leading-[1.8] text-black/70 outline-none"
            onBlur={(e) =>
              onUpdate(day.id, {
                description: e.currentTarget.textContent ?? day.description,
              })
            }
          >
            {day.description}
          </p>

          {/* Tier accommodation options */}
          <div className="space-y-3 pt-1 border-t border-black/8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-black/35 pt-1">
              Accommodation options
            </div>

            {visibleTiers.tier1 && (
              <div className="flex items-start gap-3">
                <div className="px-3 py-1 text-xs rounded-full bg-neutral-200 font-semibold min-w-[90px] text-center shrink-0">
                  {tierLabels.tier1}
                </div>
                <div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="font-medium text-[14px] outline-none"
                    onBlur={(e) =>
                      onUpdate(day.id, {
                        tier1Camp: e.currentTarget.textContent ?? day.tier1Camp,
                      })
                    }
                  >
                    {day.tier1Camp}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="text-xs text-black/45 outline-none"
                    onBlur={(e) =>
                      onUpdate(day.id, {
                        tier1Note:
                          e.currentTarget.textContent ?? day.tier1Note,
                      })
                    }
                  >
                    {day.tier1Note}
                  </div>
                </div>
              </div>
            )}

            {visibleTiers.tier2 && (
              <div className="flex items-start gap-3">
                <div className="px-3 py-1 text-xs rounded-full bg-amber-500 text-white font-semibold min-w-[90px] text-center shrink-0">
                  {tierLabels.tier2}
                </div>
                <div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="font-medium text-[14px] outline-none"
                    onBlur={(e) =>
                      onUpdate(day.id, {
                        tier2Camp: e.currentTarget.textContent ?? day.tier2Camp,
                      })
                    }
                  >
                    {day.tier2Camp}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="text-xs text-black/45 outline-none"
                    onBlur={(e) =>
                      onUpdate(day.id, {
                        tier2Note:
                          e.currentTarget.textContent ?? day.tier2Note,
                      })
                    }
                  >
                    {day.tier2Note}
                  </div>
                </div>
              </div>
            )}

            {visibleTiers.tier3 && (
              <div className="flex items-start gap-3">
                <div className="px-3 py-1 text-xs rounded-full bg-slate-600 text-white font-semibold min-w-[90px] text-center shrink-0">
                  {tierLabels.tier3}
                </div>
                <div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="font-medium text-[14px] outline-none"
                    onBlur={(e) =>
                      onUpdate(day.id, {
                        tier3Camp: e.currentTarget.textContent ?? day.tier3Camp,
                      })
                    }
                  >
                    {day.tier3Camp}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="text-xs text-black/45 outline-none"
                    onBlur={(e) =>
                      onUpdate(day.id, {
                        tier3Note:
                          e.currentTarget.textContent ?? day.tier3Note,
                      })
                    }
                  >
                    {day.tier3Note}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudioPage() {
  const [proposal, setProposal] = useState<ProposalData>(DEFAULT_PROPOSAL);

  const [visibleTiers, setVisibleTiers] = useState({
    tier1: true,
    tier2: true,
    tier3: false,
  });

  const [activeSection, setActiveSection] = useState("client");

  const updateDay = (id: string, updates: Partial<DayData>) => {
    setProposal((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));
  };

  const updateProposal = (updates: Partial<ProposalData>) => {
    setProposal((prev) => ({ ...prev, ...updates }));
  };

  const tierLabels = {
    tier1: proposal.tier1Label,
    tier2: proposal.tier2Label,
    tier3: proposal.tier3Label,
  };

  const sidebarItems = [
    { id: "client", label: "Client" },
    { id: "summary", label: "Summary" },
    ...proposal.days.map((d) => ({
      id: d.id,
      label: `Day ${d.dayNumber} · ${d.destination}`,
    })),
    { id: "pricing", label: "Pricing" },
    { id: "inclusions", label: "Inclusions" },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#f3f0ea]">
      {/* Top Bar */}
      <div className="h-14 border-b border-black/10 bg-white flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-black/40 hover:text-black/70 transition"
          >
            ← Home
          </Link>
          <span className="text-black/20">|</span>
          <div className="font-semibold text-[15px] tracking-tight">
            Safari Studio
          </div>
          <span className="text-black/20 text-sm">/</span>
          <div className="text-sm text-black/50">{proposal.tripTitle}</div>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border rounded-md bg-white hover:bg-neutral-100 transition text-sm">
            Preview
          </button>
          <button className="px-4 py-2 border rounded-md bg-white hover:bg-neutral-100 transition text-sm">
            Export PDF
          </button>
          <button className="px-4 py-2 bg-[#1b3a2d] text-white rounded-md hover:bg-[#2d5a40] transition text-sm">
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Nav Panel */}
        <div className="w-56 border-r border-black/10 bg-[#f7f4ee] p-4 shrink-0 overflow-auto">
          <div className="font-semibold mb-3 text-sm uppercase tracking-widest text-black/40">
            Structure
          </div>
          <ul className="space-y-0.5 text-[14px]">
            {sidebarItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveSection(item.id);
                    document
                      .getElementById(`section-${item.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${
                    activeSection === item.id
                      ? "bg-[#1b3a2d] text-white"
                      : "hover:bg-black/8 text-black/70"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Canvas */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Client / Header block */}
            <div
              id="section-client"
              className="bg-white border border-black/10 rounded-2xl p-8 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-black/35 mb-3">
                    Proposal for
                  </div>
                  <h1
                    contentEditable
                    suppressContentEditableWarning
                    className="text-4xl font-semibold tracking-tight outline-none"
                    onBlur={(e) =>
                      updateProposal({
                        tripTitle:
                          e.currentTarget.textContent ?? proposal.tripTitle,
                      })
                    }
                  >
                    {proposal.tripTitle}
                  </h1>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="text-lg text-black/50 mt-1 outline-none"
                    onBlur={(e) =>
                      updateProposal({
                        tripSubtitle:
                          e.currentTarget.textContent ?? proposal.tripSubtitle,
                      })
                    }
                  >
                    {proposal.tripSubtitle}
                  </div>
                </div>
                <div className="text-right space-y-1 text-sm text-black/50 shrink-0">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="outline-none font-medium text-black"
                    onBlur={(e) =>
                      updateProposal({
                        clientName:
                          e.currentTarget.textContent ?? proposal.clientName,
                      })
                    }
                  >
                    {proposal.clientName}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="outline-none"
                    onBlur={(e) =>
                      updateProposal({
                        pax: e.currentTarget.textContent ?? proposal.pax,
                      })
                    }
                  >
                    {proposal.pax}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="outline-none"
                    onBlur={(e) =>
                      updateProposal({
                        dates: e.currentTarget.textContent ?? proposal.dates,
                      })
                    }
                  >
                    {proposal.dates}
                  </div>
                </div>
              </div>

              {/* Quick stats strip */}
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-black/8 pt-6">
                {[
                  { label: "Duration", value: proposal.totalNights },
                  {
                    label: "Destinations",
                    value: `${new Set(proposal.days.map((d) => d.destination)).size} locations`,
                  },
                  {
                    label: "Consultant",
                    value: proposal.consultantName,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-xl font-semibold text-[#1b3a2d]">
                      {stat.value}
                    </div>
                    <div className="text-xs text-black/40 mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary block */}
            <div
              id="section-summary"
              className="bg-white border border-black/10 rounded-2xl p-8 shadow-sm"
            >
              <div className="text-[11px] uppercase tracking-[0.22em] text-black/35 mb-4">
                About this proposal
              </div>
              <p
                contentEditable
                suppressContentEditableWarning
                className="text-[17px] leading-[1.85] text-black/75 outline-none"
                onBlur={(e) =>
                  updateProposal({
                    summary: e.currentTarget.textContent ?? proposal.summary,
                  })
                }
              >
                {proposal.summary}
              </p>
            </div>

            {/* Day cards */}
            {proposal.days.map((day) => (
              <div id={`section-${day.id}`} key={day.id}>
                <DayCard
                  day={day}
                  tierLabels={tierLabels}
                  visibleTiers={visibleTiers}
                  onUpdate={updateDay}
                />
              </div>
            ))}

            {/* Pricing table */}
            <div
              id="section-pricing"
              className="bg-white border border-black/10 rounded-2xl p-8 shadow-sm"
            >
              <div className="text-[11px] uppercase tracking-[0.22em] text-black/35 mb-6">
                Investment
              </div>

              <div className="grid grid-cols-3 gap-4">
                {(["tier1", "tier2", "tier3"] as const).map((tier) => {
                  const isHighlighted = tier === "tier2";
                  return (
                    <div
                      key={tier}
                      className={`rounded-2xl p-6 border-2 transition ${
                        isHighlighted
                          ? "border-amber-400 bg-amber-50"
                          : "border-black/10 bg-[#f9f7f3]"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                          isHighlighted ? "text-amber-600" : "text-black/40"
                        }`}
                      >
                        {tierLabels[tier]}
                        {isHighlighted && (
                          <span className="ml-2 bg-amber-400 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <div className="text-3xl font-semibold text-black/85">
                        {proposal.currency}{" "}
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          className="outline-none"
                          onBlur={(e) => {
                            const key =
                              `${tier}PricePerPerson` as keyof ProposalData;
                            updateProposal({
                              [key]:
                                e.currentTarget.textContent ??
                                proposal[key],
                            });
                          }}
                        >
                          {
                            proposal[
                              `${tier}PricePerPerson` as keyof ProposalData
                            ] as string
                          }
                        </span>
                      </div>
                      <div className="text-xs text-black/40 mt-1">
                        per person · {proposal.totalNights}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inclusions / Exclusions */}
            <div
              id="section-inclusions"
              className="bg-white border border-black/10 rounded-2xl p-8 shadow-sm"
            >
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#1b3a2d] mb-4 font-semibold">
                    What&apos;s included
                  </div>
                  <ul className="space-y-2">
                    {proposal.inclusions.split(" · ").map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-[#1b3a2d] mt-0.5 shrink-0">
                          ✓
                        </span>
                        <span className="text-black/70">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-black/40 mb-4 font-semibold">
                    Not included
                  </div>
                  <ul className="space-y-2">
                    {proposal.exclusions.split(" · ").map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-black/30 mt-0.5 shrink-0">
                          ✗
                        </span>
                        <span className="text-black/50">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Footer note */}
              <div className="mt-8 pt-6 border-t border-black/8 flex items-center justify-between text-sm text-black/40">
                <div>
                  Prepared by{" "}
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    className="text-black/60 outline-none"
                    onBlur={(e) =>
                      updateProposal({
                        consultantName:
                          e.currentTarget.textContent ??
                          proposal.consultantName,
                      })
                    }
                  >
                    {proposal.consultantName}
                  </span>{" "}
                  ·{" "}
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    className="text-black/60 outline-none"
                    onBlur={(e) =>
                      updateProposal({
                        consultantEmail:
                          e.currentTarget.textContent ??
                          proposal.consultantEmail,
                      })
                    }
                  >
                    {proposal.consultantEmail}
                  </span>
                </div>
                <div>Safari Studio · safaristudio.co</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — Controls */}
        <div className="w-72 border-l border-black/10 bg-[#f7f4ee] p-5 shrink-0 overflow-auto">
          <div className="font-semibold mb-4 text-[15px] tracking-tight">
            Controls
          </div>

          {/* Tier visibility */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-black/40 mb-2">
              Show tiers
            </div>
            <div className="flex flex-wrap gap-2">
              {(["tier1", "tier2", "tier3"] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() =>
                    setVisibleTiers((prev) => ({
                      ...prev,
                      [tier]: !prev[tier],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                    visibleTiers[tier]
                      ? "bg-[#1b3a2d] text-white border-transparent"
                      : "bg-white hover:bg-neutral-100 border-black/15"
                  }`}
                >
                  {tierLabels[tier]}
                </button>
              ))}
            </div>
          </div>

          {/* Tier labels */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-black/40 mb-2">
              Tier labels
            </div>
            <div className="space-y-2">
              {(["tier1", "tier2", "tier3"] as const).map((tier) => (
                <input
                  key={tier}
                  value={tierLabels[tier]}
                  onChange={(e) =>
                    updateProposal({ [`${tier}Label`]: e.target.value })
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 bg-white text-sm"
                  placeholder={`${tier} label`}
                />
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-black/40 mb-2">
              Price per person
            </div>
            <div className="space-y-2">
              {(["tier1", "tier2", "tier3"] as const).map((tier) => {
                const key =
                  `${tier}PricePerPerson` as keyof ProposalData;
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <span className="text-xs text-black/40 w-16 shrink-0">
                      {tierLabels[tier]}
                    </span>
                    <input
                      value={proposal[key] as string}
                      onChange={(e) =>
                        updateProposal({ [key]: e.target.value })
                      }
                      className="flex-1 border border-black/15 rounded-lg px-3 py-2 bg-white text-sm"
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Assistant */}
          <div>
            <div className="text-xs uppercase tracking-widest text-black/40 mb-2">
              AI Assistant
            </div>
            <textarea
              className="w-full border border-black/15 rounded-lg p-3 min-h-[110px] bg-white text-sm resize-none"
              placeholder="Ask AI to improve the writing, suggest alternatives, adjust the tone..."
            />
            <button className="w-full mt-2 py-2 bg-[#1b3a2d] text-white rounded-lg text-sm hover:bg-[#2d5a40] transition">
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
