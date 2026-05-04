"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";
import { COVER_LAYOUTS, COVER_LETTER_SPREAD } from "@/lib/pdfFit/manifests/cover";
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
  // layout id when available; otherwise default to the combined
  // cover + letter spread. The combined spread folds the personal
  // note into the cover so a sparse 2-page opening becomes one
  // editorial spread.
  const manifest =
    COVER_LAYOUTS.find((l) => l.id === section.layoutVariant) ??
    COVER_LETTER_SPREAD;

  // Variant id — visual treatment layered on the manifest. Stored
  // separately from layoutVariant on section.content so an operator
  // can pair "cover-cinematic-hero" structure with "editorial"
  // emphasis without duplicating the manifest. Falls back to
  // "cinematic" — matches the default look for the cinematic-hero
  // manifest.
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

  // ─── Letter content (combined spread) ────────────────────────────────
  // Pulled from the proposal's personalNote section so the operator
  // doesn't have to keep two copies of the welcome message in sync.
  // The print orchestrator skips the stand-alone personalNote page
  // when this combined cover is in play.
  const personalNote = proposal.sections?.find((s) => s.type === "personalNote");
  const opener = strField(personalNote?.content?.opener);
  const body = stripHtml(strField(personalNote?.content?.body) ?? "");
  const signOff = strField(personalNote?.content?.signOff);
  const letterBody = [opener, body, signOff].filter(Boolean).join("\n\n");

  const operator = proposal.operator;
  const advisorName = operator?.consultantName?.trim() || "";
  const advisorTitle = operator?.consultantRole?.trim() || "";
  const advisorImageUrl = operator?.consultantPhoto?.trim() || null;
  const signatureUrl = operator?.signatureUrl?.trim() || null;
  const contactEmail = operator?.email?.trim() || "";
  const contactWhatsapp =
    operator?.whatsapp?.trim() || operator?.phone?.trim() || "";

  const contents: Record<string, SlotContent> = {
    hero_image: { kind: "image", url: heroImageUrl, alt: tripTitle },
    operator_logo: { kind: "image", url: operatorLogoUrl, alt: "" },
    trip_title: { kind: "text", value: tripTitle },
    trip_meta: { kind: "text", value: tripMeta },
    letter_body: { kind: "text", value: letterBody },
    signature_image: { kind: "image", url: signatureUrl, alt: "Signature" },
    advisor_name: { kind: "text", value: advisorName },
    advisor_title: { kind: "text", value: advisorTitle },
    advisor_image: { kind: "image", url: advisorImageUrl, alt: advisorName },
    contact_email: { kind: "text", value: contactEmail },
    contact_whatsapp: { kind: "text", value: contactWhatsapp },
    logo_small: { kind: "image", url: operatorLogoUrl, alt: "" },
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

function strField(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
