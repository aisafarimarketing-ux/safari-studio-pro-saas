"use client";

import type { LayoutManifest, Slot } from "@/lib/pdfFit/types";
import type { ProposalTheme, ThemeTokens } from "@/lib/types";
import { resolveVariantAdjustment } from "@/lib/pdfFit/variants";
import { PdfFitSlot, type SlotContent } from "./PdfFitSlot";

// ─── PdfFitLayout — manifest-driven layout renderer ────────────────────────
//
// Takes a LayoutManifest + a content map (slot name → resolved content)
// + theme/tokens, returns a full-A4 absolutely-positioned slot stack.
//
// Optional variantId selects a visual treatment from the variant
// registry — variants never change positions, only typography emphasis,
// color emphasis, image filters, and fill overrides. The layout
// container resolves the variant adjustment for each slot once and
// passes it to PdfFitSlot.

type Props = {
  manifest: LayoutManifest;
  /** Map of slot.name → content. Slots without entries render empty
   *  (text → blank, image → soft fill, etc.). */
  contents: Record<string, SlotContent>;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  /** Variant id from the section's variant axis. e.g. "cinematic" /
   *  "editorial" / "minimal_luxury" for cover. Falls back to base
   *  styling when undefined. */
  variantId?: string;
};

export function PdfFitLayout({ manifest, contents, theme, tokens, variantId }: Props) {
  return (
    <div
      data-pdf-fit-layout={manifest.id}
      data-pdf-fit-section={manifest.section}
      data-pdf-fit-variant={variantId ?? ""}
      style={{
        position: "relative",
        width: "210mm",
        height: "297mm",
        overflow: "hidden",
        // Use the theme's cream "paper" surface instead of pageBg.
        // Many themes set pageBg to a saturated brand colour that
        // works on screen but kills text contrast in print, where
        // body text is dark by default. cardBg is the surface text
        // is designed to sit on; the operator's brand still shows
        // through accent strips, headings, and full-bleed images.
        background: tokens.cardBg,
      }}
    >
      {manifest.slots.map((slot) => (
        <PdfFitSlot
          key={slot.name}
          slot={slot}
          content={contents[slot.name]}
          contents={contents}
          theme={theme}
          tokens={tokens}
          adjustment={resolveVariantAdjustment(manifest.section, variantId, slot.name)}
        />
      ))}
    </div>
  );
}

// Helper — substitute {placeholder} tokens in a content_pattern string
// against a values map. Unknown placeholders pass through verbatim so
// missing data is visible at render time.
export function applyContentPattern(
  pattern: string,
  values: Record<string, string | undefined | null>,
): string {
  return pattern.replace(/\{(\w+)\}/g, (match, key) => {
    const v = values[key];
    if (v === undefined || v === null) return match;
    const trimmed = String(v).trim();
    return trimmed.length > 0 ? trimmed : match;
  });
}

// Helper — flatten a manifest's slots into an array, resolving group
// children into their parent's coordinate space. Used when the layout
// has nested groups; PdfFitSlot already handles the recursion but
// callers sometimes need a flat list (e.g. content-fit auditing).
export function flattenSlots(slots: Slot[]): Slot[] {
  const out: Slot[] = [];
  for (const slot of slots) {
    out.push(slot);
    if (slot.type === "group" && slot.slots) {
      out.push(...flattenSlots(slot.slots));
    }
  }
  return out;
}
