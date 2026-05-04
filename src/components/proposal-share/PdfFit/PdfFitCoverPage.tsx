"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";
import { COVER_LAYOUTS } from "@/lib/pdfFit/manifests/cover";
import { PdfFitLayout, applyContentPattern } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit cover page renderer ──────────────────────────────────────────
//
// Resolves content for a cover section against one of three layout
// manifests (cinematic / editorial-split / minimal). Picks the
// manifest from the section's layoutVariant when set, falling back
// to cinematic-hero (the safest "looks-good-out-of-the-box" pick).
//
// Content map:
//   heroImageUrl     ← cover section's hero image OR operator's logo as fallback
//   operatorLogoUrl  ← operator.logoUrl
//   tripTitle        ← proposal.metadata.title
//   trip_meta        ← compound: "{destinations} · {dates} · {duration}"
//
// Wrapped in a bleed PdfPage so the layout fills A4 edge-to-edge —
// the manifest's coordinates already account for safe margins where
// they apply.

type Props = {
  section: Section;
};

export function PdfFitCoverPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  // Pick the manifest: section.layoutVariant is the operator-set
  // layout id when available; otherwise default to cinematic-hero.
  const manifest =
    COVER_LAYOUTS.find((l) => l.id === section.layoutVariant) ?? COVER_LAYOUTS[0];

  // Variant id — visual treatment layered on the manifest. Stored
  // separately from layoutVariant on section.content so an operator
  // can pair "cover-cinematic-hero" structure with "editorial"
  // emphasis without duplicating the manifest. Falls back to
  // "cinematic" — matches the default look for this layout.
  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "cinematic";

  // ─── Content resolution ──────────────────────────────────────────────
  const heroImageUrl =
    (section.content.heroImageUrl as string | undefined) ||
    proposal.operator?.logoUrl ||
    null;
  const operatorLogoUrl = proposal.operator?.logoUrl || null;
  const tripTitle =
    proposal.metadata?.title?.trim() ||
    proposal.trip?.title?.trim() ||
    "Your safari";

  // Compound meta — substitute via applyContentPattern. The manifest
  // declares the pattern; we provide the values; missing values leave
  // the {placeholder} visible (deliberate — operator sees what's
  // missing rather than a silent gap).
  const tripMeta = applyContentPattern(
    "{destinations} · {dates} · {duration}",
    {
      destinations: (proposal.trip?.destinations ?? []).slice(0, 3).join(", "),
      dates: proposal.trip?.dates ?? "",
      duration: formatDuration(proposal.trip?.nights ?? 0),
    },
  );

  const contents: Record<string, SlotContent> = {
    hero_image: { kind: "image", url: heroImageUrl, alt: tripTitle },
    operator_logo: { kind: "image", url: operatorLogoUrl, alt: "" },
    trip_title: { kind: "text", value: tripTitle },
    trip_meta: { kind: "text", value: tripMeta },
  };

  return (
    <PdfPage label="Cover" bleed>
      <div data-section-type="cover" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={manifest}
          contents={contents}
          theme={proposal.theme}
          tokens={tokens}
          variantId={variantId}
        />
      </div>
    </PdfPage>
  );
}

function formatDuration(nights: number): string {
  if (!nights || nights <= 0) return "";
  const days = nights + 1;
  return `${days} days · ${nights} ${nights === 1 ? "night" : "nights"}`;
}
