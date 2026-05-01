import type { Proposal, Section } from "@/lib/types";

// ─── sectionLeadImage ───────────────────────────────────────────────────
//
// Spread view (the two-column sticky layout) needs ONE photograph per
// section to anchor the left column. This is the canonical lookup —
// every section type gets a sensible default with a chain of fallbacks
// so a fresh proposal looks right with zero operator effort.
//
// Per-section behaviour:
//
//   cover            → section.content.heroImageUrl (the cover hero
//                      itself).
//   personalNote     → operator.consultantPhoto, fallback cover hero.
//   map              → first day's hero, fallback cover hero.
//   dayJourney       → null (the spread layout splits this section into
//                      one sticky pane per DAY; the canvas resolves
//                      each day's image individually).
//   propertyShowcase → null (same — one pane per property block).
//   pricing          → cover hero (the trip's signature photo).
//   practicalInfo    → cover hero or first day's hero.
//   closing          → section.content.themeImageUrl, fallback cover hero.
//   footer           → operator.logoUrl-bearing card on a soft surface.
//   itineraryTable   → cover hero or first day's hero.
//   divider          → null (dividers are visual rhythm, not content;
//                      they don't get their own pane in spread mode).
//
// Returning `null` means the canvas should treat the section as
// "passes through inline" — no sticky pane, just continuous flow on
// the right column.

export function sectionLeadImage(
  section: Section,
  proposal: Proposal,
): string | null {
  const coverHero = (() => {
    const cover = proposal.sections.find((s) => s.type === "cover");
    return (cover?.content?.heroImageUrl as string | undefined) ?? null;
  })();
  const firstDayHero = proposal.days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .find((d) => d.heroImageUrl)?.heroImageUrl ?? null;

  switch (section.type) {
    case "cover":
      return (section.content?.heroImageUrl as string | undefined) ?? null;
    case "personalNote":
      return proposal.operator.consultantPhoto || coverHero;
    case "map":
      return firstDayHero || coverHero;
    case "dayJourney":
    case "propertyShowcase":
    case "divider":
      // Per-sub-element panes are resolved by the canvas, not here.
      return null;
    case "pricing":
      return coverHero || firstDayHero;
    case "practicalInfo":
      return coverHero || firstDayHero;
    case "closing":
      return (
        (section.content?.themeImageUrl as string | undefined) || coverHero
      );
    case "footer":
      return null;
    case "itineraryTable":
      return coverHero || firstDayHero;
    default:
      return coverHero;
  }
}

// Section's white-caps label rendered over the sticky image. Operators
// can override per-section by setting `section.content.spreadLabel`.
// Falls back to a sensible default per type.
export function sectionSpreadLabel(section: Section): string {
  const override = section.content?.spreadLabel as string | undefined;
  if (override?.trim()) return override.trim();
  switch (section.type) {
    case "cover":
      return "WELCOME";
    case "personalNote":
      return "YOUR CONSULTANT";
    case "map":
      return "MAP";
    case "itineraryTable":
      return "AT A GLANCE";
    case "dayJourney":
      return "DAY-BY-DAY";
    case "propertyShowcase":
      return "ACCOMMODATIONS";
    case "pricing":
      return "INVESTMENT";
    case "practicalInfo":
      return "GOOD TO KNOW";
    case "closing":
      return "READY?";
    case "footer":
      return "";
    default:
      return "";
  }
}

// Eyebrow line above the section label ("— Itinerary details").
// Static per type; mirrors the convention Safari Portal uses on its
// sticky panes. Operators can override via `section.content.spreadEyebrow`.
export function sectionSpreadEyebrow(section: Section): string {
  const override = section.content?.spreadEyebrow as string | undefined;
  if (override?.trim()) return override.trim();
  switch (section.type) {
    case "cover":
      return "— Your journey begins";
    case "personalNote":
      return "— A note from us";
    case "map":
      return "— Itinerary details";
    case "itineraryTable":
      return "— Itinerary details";
    case "dayJourney":
      return "— Day by day";
    case "propertyShowcase":
      return "— Suggested resorts";
    case "pricing":
      return "— Investment";
    case "practicalInfo":
      return "— Good to know";
    case "closing":
      return "— Secure your trip";
    default:
      return "";
  }
}
