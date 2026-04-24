import type { Day, Property, Proposal, Section, TierKey } from "@/lib/types";
import type { RouteCoord } from "@/components/sections/RouteMap";
import { buildBlankProposal } from "@/lib/defaults";
import { STARTER_LIBRARY, type StarterProperty } from "@/lib/starterLibrary";
import { lookupDemoCoord } from "@/lib/demoDestinationCoords";
import { nanoid } from "@/lib/nanoid";
import type { Template } from "./types";

// ─── Build a Proposal from a Template ──────────────────────────────────────
//
// Two consumer modes:
//
//   preview  — rendering the public /templates/[slug] page. We populate
//              the exampleClient, a stand-in operator block, and the full
//              visual payload (cover hero, day heroes, property images,
//              map coords). Nothing about it is operator-specific; the
//              visitor sees a polished, realistic example.
//
//   clone    — operator clicks "Use this template" and we produce a
//              fresh proposal scoped to their org. Personal fields are
//              cleared, operator block is populated from their profile,
//              everything else carries over so they start with the full
//              shape and edit freely.

export type BuildMode = "preview" | "clone";

export type BuildOptions = {
  mode?: BuildMode;
  operator?: {
    companyName?: string;
    consultantName?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
  };
  // Optional pool of operator-provided images (data URLs from the
  // ImageUploader on /templates/[slug]). When present, these override
  // the starter library images on cover, day heroes, property leads,
  // and property galleries — in that priority order, cycling if fewer
  // images than slots need filling. Empty/omitted = starter images only.
  userImages?: string[];
};

export function buildProposalFromTemplate(
  tpl: Template,
  opts: BuildOptions = {},
): Proposal {
  const mode: BuildMode = opts.mode ?? "preview";
  const proposal = buildBlankProposal();
  const pool = buildImagePool(opts.userImages ?? []);

  // ── Metadata + trip ────────────────────────────────────────────────
  const destinations = deriveDestinations(tpl);
  proposal.metadata.title = tpl.title;
  proposal.trip.title = tpl.title;
  proposal.trip.subtitle = tpl.summary;
  proposal.trip.nights = tpl.nights;
  proposal.trip.destinations = destinations;
  proposal.trip.tripStyle = tpl.style;

  // ── Client (example in preview, blank in clone) ────────────────────
  if (mode === "preview") {
    const ex = tpl.exampleClient;
    proposal.client.guestNames = ex.guestNames;
    proposal.client.adults = ex.adults;
    proposal.client.children = ex.children ?? 0;
    proposal.client.pax = formatPax(ex.adults, ex.children ?? 0);
    if (ex.origin) proposal.client.origin = ex.origin;
    if (ex.specialOccasion) proposal.client.specialOccasion = ex.specialOccasion;
  } else {
    // Clone: leave client fields empty so the operator fills in the real client
    proposal.client.guestNames = "";
    proposal.client.pax = "";
  }

  // ── Operator ───────────────────────────────────────────────────────
  if (opts.operator) {
    proposal.operator.companyName = opts.operator.companyName ?? "";
    proposal.operator.consultantName = opts.operator.consultantName ?? "";
    proposal.operator.email = opts.operator.email ?? "";
    proposal.operator.phone = opts.operator.phone ?? "";
    if (opts.operator.logoUrl) proposal.operator.logoUrl = opts.operator.logoUrl;
  } else if (mode === "preview") {
    proposal.operator.companyName = "Safari Studio Demo";
    proposal.operator.consultantName = "Your consultant";
    proposal.operator.email = "hello@safaristudio.com";
    proposal.operator.phone = "+254 700 000 000";
  }

  // ── Active tier (tracks "style") ───────────────────────────────────
  const activeTier: TierKey =
    tpl.style === "Luxury" ? "signature" : tpl.style === "Classic" ? "classic" : "premier";
  proposal.activeTier = activeTier;

  // ── Days + properties from the library ─────────────────────────────
  const libraryByName = buildLibraryIndex();
  const usedStarters = new Map<string, StarterProperty>(); // dedupe

  proposal.days = tpl.days.map((td): Day => {
    const id = nanoid();
    // Resolve active-tier camp → starter library → set hero image.
    // User-uploaded images take priority over starter gallery shots.
    const activeCampName = td.tiers[activeTier].libraryName;
    const starter = libraryByName.get(normaliseName(activeCampName));
    const heroImageUrl =
      pool.take() ?? starter?.galleryUrls[0] ?? starter?.leadImageUrl;
    // Record all tier camps for the properties list.
    for (const t of ["classic", "premier", "signature"] as const) {
      const name = td.tiers[t].libraryName;
      const s = libraryByName.get(normaliseName(name));
      if (s && !usedStarters.has(s.name)) usedStarters.set(s.name, s);
    }
    return {
      id,
      dayNumber: td.dayNumber,
      destination: td.destination,
      country: td.country,
      subtitle: td.subtitle,
      description: td.description,
      board: td.board,
      highlights: td.highlights,
      heroImageUrl,
      tiers: {
        classic:   { camp: td.tiers.classic.libraryName,   location: starterLocation(td.tiers.classic.libraryName, libraryByName, td.destination),   note: td.tiers.classic.note ?? "" },
        premier:   { camp: td.tiers.premier.libraryName,   location: starterLocation(td.tiers.premier.libraryName, libraryByName, td.destination),   note: td.tiers.premier.note ?? "" },
        signature: { camp: td.tiers.signature.libraryName, location: starterLocation(td.tiers.signature.libraryName, libraryByName, td.destination), note: td.tiers.signature.note ?? "" },
      },
    };
  });

  // proposal.properties[] — StayCard looks up by camp name.
  // Nights per property = how many active-tier days point at it.
  // If the operator uploaded images, their pool overrides the starter
  // lead image and seeds the gallery; starter gallery entries fill any
  // remaining slots up to four.
  proposal.properties = Array.from(usedStarters.values()).map((s): Property => {
    const nights = proposal.days.reduce((n, d) => {
      const match = d.tiers[activeTier]?.camp?.trim().toLowerCase() === s.name.toLowerCase();
      return n + (match ? 1 : 0);
    }, 0) || 1;
    const leadUser = pool.take();
    const leadImageUrl = leadUser ?? s.leadImageUrl;
    const userGallery: string[] = [];
    while (userGallery.length < 3 && pool.hasAny()) {
      const next = pool.take();
      if (next) userGallery.push(next);
      else break;
    }
    const galleryUrls = userGallery.length > 0
      ? [...userGallery, ...s.galleryUrls].slice(0, 4)
      : s.galleryUrls.slice(0, 4);
    return {
      id: nanoid(),
      name: s.name,
      location: s.locationName,
      shortDesc: s.shortSummary,
      description: s.whatMakesSpecial,
      whyWeChoseThis: s.whyWeChoose,
      amenities: s.amenities,
      mealPlan: s.mealPlan,
      roomType: s.propertyClass,
      nights,
      leadImageUrl,
      galleryUrls,
      checkInTime: s.checkInTime,
      checkOutTime: s.checkOutTime,
      totalRooms: s.totalRooms,
      spokenLanguages: s.spokenLanguages,
      specialInterests: s.specialInterests,
    };
  });

  // ── Pricing ────────────────────────────────────────────────────────
  proposal.pricing = {
    classic: {
      ...proposal.pricing.classic,
      pricePerPerson: tpl.pricing.classic.pricePerPerson,
      currency: tpl.pricing.classic.currency ?? "USD",
      highlighted: tpl.pricing.highlighted === "classic",
    },
    premier: {
      ...proposal.pricing.premier,
      pricePerPerson: tpl.pricing.premier.pricePerPerson,
      currency: tpl.pricing.premier.currency ?? "USD",
      highlighted: tpl.pricing.highlighted === "premier",
    },
    signature: {
      ...proposal.pricing.signature,
      pricePerPerson: tpl.pricing.signature.pricePerPerson,
      currency: tpl.pricing.signature.currency ?? "USD",
      highlighted: tpl.pricing.highlighted === "signature",
    },
    notes: tpl.pricing.notes,
  };

  // ── Proposal-level arrays ──────────────────────────────────────────
  proposal.inclusions = [...tpl.inclusions];
  proposal.exclusions = [...tpl.exclusions];
  proposal.practicalInfo = tpl.practicalInfo.map((c) => ({
    id: nanoid(),
    title: c.title,
    body: c.body,
    icon: c.icon,
  }));

  // ── Section content (cover / greeting / closing / map) + map coords
  const coords = buildRouteCoords(proposal.days);
  const coverHero =
    proposal.days[0]?.heroImageUrl ??
    (proposal.properties[0]?.leadImageUrl ?? undefined);

  proposal.sections = proposal.sections.map((s): Section => {
    switch (s.type) {
      case "cover": {
        const content = { ...s.content, tagline: tpl.cover.tagline };
        if (coverHero) (content as { heroImageUrl?: string }).heroImageUrl = coverHero;
        return { ...s, content };
      }
      case "greeting":
        return { ...s, content: { ...s.content, body: tpl.greeting.body } };
      case "closing":
        return { ...s, content: { ...s.content, quote: tpl.closing.quote, signOff: tpl.closing.signOff } };
      case "map":
        return { ...s, content: { ...s.content, caption: tpl.map.caption, coords } };
      default:
        return s;
    }
  });

  return proposal;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function deriveDestinations(tpl: Template): string[] {
  // Collapse consecutive same-destination days into a single entry
  const out: string[] = [];
  for (const d of tpl.days) {
    const dest = d.destination.trim();
    if (!dest) continue;
    if (out[out.length - 1] !== dest) out.push(dest);
  }
  return out;
}

function buildLibraryIndex(): Map<string, StarterProperty> {
  const m = new Map<string, StarterProperty>();
  for (const p of STARTER_LIBRARY) {
    m.set(normaliseName(p.name), p);
  }
  return m;
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

function starterLocation(
  name: string,
  index: Map<string, StarterProperty>,
  fallback: string,
): string {
  const s = index.get(normaliseName(name));
  return s?.locationName ?? fallback;
}

function buildRouteCoords(days: Day[]): RouteCoord[] {
  const coords: RouteCoord[] = [];
  for (const d of days) {
    const c = lookupDemoCoord(d.destination);
    if (!c) continue;
    coords.push({
      dayId: d.id,
      dayNumber: d.dayNumber,
      label: d.destination,
      lat: c.lat,
      lng: c.lng,
    });
  }
  return coords;
}

function formatPax(adults: number, children: number): string {
  if (children > 0) return `${adults} adults · ${children} children`;
  return `${adults} ${adults === 1 ? "adult" : "adults"}`;
}

// Cycling image pool. If the operator provided photos, they get first
// pick on every "next image" request; if the caller asks for more than
// were provided we cycle back to the start. Empty pool returns null so
// the caller can fall back to starter-library images.
function buildImagePool(userImages: string[]) {
  let cursor = 0;
  const pool = userImages.slice();
  return {
    take(): string | null {
      if (pool.length === 0) return null;
      const img = pool[cursor % pool.length];
      cursor += 1;
      return img;
    },
    hasAny(): boolean {
      return pool.length > 0;
    },
  };
}
