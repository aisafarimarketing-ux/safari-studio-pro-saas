import type { Section, Proposal, Day, Property } from "./types";

// ─── PDF page composer ────────────────────────────────────────────────────
//
// Walks the proposal's visible sections in operator order and groups
// related blocks into intentional A4 pages. Replaces the prior 1:1
// section-per-page render walk with a small set of merge rules so the
// printed deck reads like a designed document rather than a list of
// editor blocks.
//
// Adjacency-based merging — the operator controls composition by
// reordering sections. A cover only merges with a personal note when
// they sit next to each other in the section list; otherwise both
// emit their own pages. Same logic for map+summary and closing+footer.
//
// divider / spacer / inclusions are dropped before the walk:
//   - divider/spacer are web-view rhythm controls (already skipped in
//     the legacy printer per PrintProposalDocument behavior).
//   - inclusions is deprecated — data lives at proposal.inclusions /
//     proposal.exclusions and renders inside the Pricing page.

export type PdfPage =
  | { kind: "coverNote";     cover?: Section; note?: Section }
  | { kind: "mapSummary";    map?: Section; summary?: Section }
  | { kind: "day";           day: Day; sourceSection: Section; totalDays: number }
  | { kind: "property";      property: Property; sourceSection: Section; index: number; total: number }
  | { kind: "pricing";       section: Section }
  | { kind: "practicalInfo"; section: Section }
  | { kind: "closing";       closing?: Section; footer?: Section }
  | { kind: "passthrough";   section: Section };

const SKIP_TYPES: ReadonlySet<Section["type"]> = new Set([
  "divider",
  "spacer",
  "inclusions",
]);

export function composePdfPages(proposal: Proposal): PdfPage[] {
  const sections = [...(proposal.sections ?? [])]
    .filter((s) => s.visible && !SKIP_TYPES.has(s.type))
    .sort((a, b) => a.order - b.order);

  const pages: PdfPage[] = [];
  // Tracks ids consumed by an earlier merge so the iterator skips
  // them when their natural turn comes around.
  const claimed = new Set<string>();

  const days = [...(proposal.days ?? [])].sort(
    (a, b) => a.dayNumber - b.dayNumber,
  );
  const properties = proposal.properties ?? [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (claimed.has(section.id)) continue;
    const next: Section | undefined = sections[i + 1];

    switch (section.type) {
      case "cover": {
        if (next?.type === "personalNote") {
          pages.push({ kind: "coverNote", cover: section, note: next });
          claimed.add(next.id);
        } else {
          pages.push({ kind: "coverNote", cover: section });
        }
        break;
      }

      case "personalNote": {
        // Reaches here only when the cover-adjacent merge above didn't
        // claim this note (no preceding cover, or cover wasn't its
        // direct neighbor). Emit a coverNote page anchored on the note
        // alone — the dispatcher renders the legacy single-section
        // personal note layout.
        pages.push({ kind: "coverNote", note: section });
        break;
      }

      case "map": {
        if (next?.type === "itineraryTable" || next?.type === "tripSummary") {
          pages.push({ kind: "mapSummary", map: section, summary: next });
          claimed.add(next.id);
        } else {
          pages.push({ kind: "mapSummary", map: section });
        }
        break;
      }

      case "itineraryTable":
      case "tripSummary": {
        if (next?.type === "map") {
          pages.push({ kind: "mapSummary", map: next, summary: section });
          claimed.add(next.id);
        } else {
          // No adjacent map — fall through to passthrough so the
          // existing renderer keeps showing the standalone summary.
          // mapSummary needs a map; without one it would be a weak page.
          pages.push({ kind: "passthrough", section });
        }
        break;
      }

      case "dayJourney": {
        if (days.length === 0) {
          pages.push({ kind: "passthrough", section });
        } else {
          for (const day of days) {
            pages.push({
              kind: "day",
              day,
              sourceSection: section,
              totalDays: days.length,
            });
          }
        }
        break;
      }

      case "propertyShowcase": {
        if (properties.length === 0) {
          pages.push({ kind: "passthrough", section });
        } else {
          properties.forEach((property, index) => {
            pages.push({
              kind: "property",
              property,
              sourceSection: section,
              index,
              total: properties.length,
            });
          });
        }
        break;
      }

      case "pricing":
        pages.push({ kind: "pricing", section });
        break;

      case "practicalInfo":
        pages.push({ kind: "practicalInfo", section });
        break;

      case "closing": {
        if (next?.type === "footer") {
          pages.push({ kind: "closing", closing: section, footer: next });
          claimed.add(next.id);
        } else {
          pages.push({ kind: "closing", closing: section });
        }
        break;
      }

      case "footer": {
        // Lone footer (no preceding closing). Folded into a closing
        // page rather than emitted as a footer-only A4 — keeps the
        // deck from ending on a thin contact card.
        pages.push({ kind: "closing", footer: section });
        break;
      }

      default:
        pages.push({ kind: "passthrough", section });
        break;
    }
  }

  return pages;
}
