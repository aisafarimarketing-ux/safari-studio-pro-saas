"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";
import { CLOSING_FAREWELL, CLOSING_LAYOUTS } from "@/lib/pdfFit/manifests/closing";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit closing page ──────────────────────────────────────────────────
//
// Editorial farewell: hero image up top, contact card below. Hero
// resolves from section.content.themeImageUrl → cover hero → null.
// Contact rows use the operator's email / whatsapp / website. Trust
// badges fall back to the operator's profile list.

type Props = { section: Section };

export function PdfFitClosingPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "calm_luxury";

  // Layout pick — operator's section.layoutVariant chooses which
  // closing manifest renders; falls back to the editorial farewell.
  const manifest =
    CLOSING_LAYOUTS.find((l) => l.id === section.layoutVariant) ?? CLOSING_FAREWELL;

  const heroImageUrl =
    str(section.content?.themeImageUrl) ??
    findCoverHeroUrl(proposal.sections) ??
    null;

  const operator = proposal.operator;
  const trip = proposal.trip;

  // All text comes from the operator's section content or backend
  // operator profile. Empty fields render as empty slots — no
  // synthesized headlines, taglines, or CTAs.
  const eyebrow =
    str(section.content?.themeLabel) ?? str(trip?.tripStyle) ?? "";

  const headline = str(section.content?.headline) ?? "";

  const bodyIntro = stripHtml(
    str(section.content?.letter) ?? str(section.content?.signOff) ?? "",
  );

  const ctaLabel = str(section.content?.ctaLabel) ?? "";

  // Primary CTA: booking URL > whatsapp > email — only renders when
  // operator has filled at least one of these on their profile and
  // a label exists in section.content.
  const bookingUrl = operator?.bookingUrl?.trim();
  const whatsapp = operator?.whatsapp?.trim();
  const email = operator?.email?.trim();
  const phone = operator?.phone?.trim();
  const website = operator?.website?.trim();

  const primaryCta = !ctaLabel
    ? ""
    : bookingUrl
      ? `${ctaLabel}  →  ${stripScheme(bookingUrl)}`
      : whatsapp
        ? `${ctaLabel}  →  WhatsApp ${whatsapp}`
        : email
          ? `${ctaLabel}  →  ${email}`
          : ctaLabel;

  const secondaryCta1 = email ? `Email · ${email}` : "";
  const secondaryCta2 = whatsapp
    ? `WhatsApp · ${whatsapp}`
    : phone
      ? `Phone · ${phone}`
      : "";
  const secondaryCta3 = website ? `Web · ${stripScheme(website)}` : "";

  const trustBadgesArr = (operator?.trustBadges ?? []).slice(0, 3);
  const trustBadges = trustBadgesArr.map((b) => `•  ${b}`).join("\n");

  const brandLine =
    operator?.companyName?.trim() ||
    proposal.metadata?.title?.trim() ||
    "";

  const contents: Record<string, SlotContent> = {
    hero_image: { kind: "image", url: heroImageUrl, alt: headline },
    eyebrow: { kind: "text", value: eyebrow },
    headline: { kind: "text", value: headline },
    body_intro: { kind: "text", value: bodyIntro },
    primary_cta: { kind: "text", value: primaryCta },
    secondary_cta_1: { kind: "text", value: secondaryCta1 },
    secondary_cta_2: { kind: "text", value: secondaryCta2 },
    secondary_cta_3: { kind: "text", value: secondaryCta3 },
    trust_badges: { kind: "text", value: trustBadges },
    brand_line: { kind: "text", value: brandLine },
  };

  return (
    <PdfPage label="Closing" bleed>
      <div data-section-type="closing" style={{ width: "100%", height: "100%" }}>
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

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
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

function findCoverHeroUrl(sections: Section[]): string | undefined {
  const cover = sections.find((s) => s.type === "cover");
  if (!cover) return undefined;
  const v = cover.content?.heroImageUrl;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
