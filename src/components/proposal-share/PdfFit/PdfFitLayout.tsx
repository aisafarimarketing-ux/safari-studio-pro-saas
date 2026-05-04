"use client";

import type { LayoutManifest, Slot } from "@/lib/pdfFit/types";
import type { ProposalTheme, ThemeTokens } from "@/lib/types";
import { PdfFitSlot, type SlotContent } from "./PdfFitSlot";

// ─── PdfFitLayout — manifest-driven layout renderer ────────────────────────
//
// Takes a LayoutManifest + a content map (slot name → resolved content)
// + theme/tokens, returns a full-A4 absolutely-positioned slot stack.
//
// The caller is responsible for resolving each slot's content_key /
// content_pattern against the proposal data. We don't do that here
// because resolution is section-specific (cover reads operator.logoUrl,
// day card reads day.heroImageUrl, etc.) — caller knows the shape.

type Props = {
  manifest: LayoutManifest;
  /** Map of slot.name → content. Slots without entries render empty
   *  (text → blank, image → soft fill, etc.). */
  contents: Record<string, SlotContent>;
  theme: ProposalTheme;
  tokens: ThemeTokens;
};

export function PdfFitLayout({ manifest, contents, theme, tokens }: Props) {
  return (
    <div
      data-pdf-fit-layout={manifest.id}
      data-pdf-fit-section={manifest.section}
      style={{
        position: "relative",
        width: "210mm",
        height: "297mm",
        overflow: "hidden",
        background: tokens.pageBg,
      }}
    >
      {manifest.slots.map((slot) => (
        <PdfFitSlot
          key={slot.name}
          slot={slot}
          content={contents[slot.name]}
          theme={theme}
          tokens={tokens}
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
