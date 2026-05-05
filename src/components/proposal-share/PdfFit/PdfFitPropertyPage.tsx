"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Property, Section } from "@/lib/types";
import {
  PROPERTY_CARD_LAYOUTS,
  PROPERTY_CARD_STANDARD,
} from "@/lib/pdfFit/manifests/property_card";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit property page renderer ────────────────────────────────────────
//
// One PdfPage per property in the showcase. Resolves content for the
// property_card_standard manifest:
//
//   section_title  ← "Property N of M"
//   property_name  ← property.name
//   location_meta  ← property.location + " · " + property.tier (when set)
//   description    ← property.description (HTML stripped) || shortDesc
//   stay_details   ← compound: rooms · meal · check-in/out
//   features_list  ← top 6 amenities
//   main_image     ← property.leadImageUrl
//   thumb_1/2/3    ← first 3 gallery URLs (excluding the lead)
//
// Variants (image_luxury / info_rich / balanced) tweak emphasis only.

type Props = {
  section: Section;
  property: Property;
  index: number;
  total: number;
};

export function PdfFitPropertyPage({ section, property, index, total }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "balanced";

  // Per-property layout pick — operator may store layoutVariant on
  // the property record (property.layoutVariant = "property-card-feature")
  // to mix variants across the showcase. Rhythm engine in the
  // orchestrator synthesises one when none is set; section-level
  // layoutVariant is the next fallback; finally the balanced standard.
  const propertyLayoutVariantRaw =
    property.layoutVariant ?? section.layoutVariant;
  const manifest =
    PROPERTY_CARD_LAYOUTS.find((l) => l.id === propertyLayoutVariantRaw) ??
    PROPERTY_CARD_STANDARD;

  // ─── Content resolution ──────────────────────────────────────────────
  // All fields come from the property record verbatim. Empty backend
  // → empty slot (the layout still renders structural eyebrows so
  // the editor / operator sees the gap).
  const sectionTitle = `Property ${index + 1} of ${total}`;
  const propertyName = property.name?.trim() || "";
  const locationMeta = [
    property.location?.trim() || "",
    property.tier?.trim() || "",
  ].filter(Boolean).join(" · ");
  const whyWeChoseThis = property.whyWeChoseThis?.trim() || "";

  const description =
    stripHtml(property.description ?? "").trim() ||
    property.shortDesc?.trim() ||
    "";

  // YOUR STAY 5-row stat grid — labels are structural (always visible
  // via the manifest); values come from backend property fields. Em
  // dash for missing values so each row reads as a proper key/value
  // pair instead of a blank line.
  const stayRows = [
    { label: "NIGHTS", value: property.nights ? String(property.nights) : "—" },
    { label: "ROOM", value: property.roomType?.trim() || "—" },
    { label: "MEAL", value: property.mealPlan?.trim() || "—" },
    { label: "CHECK-IN", value: property.checkInTime?.trim() || "—" },
    { label: "CHECK-OUT", value: property.checkOutTime?.trim() || "—" },
  ];

  // AT A GLANCE — amenities. Top 6 joined with " · " for inline
  // editorial reading (no SVG icons in PDF; legacy magazine has
  // them on screen).
  const amenitiesList =
    (property.amenities ?? [])
      .filter(Boolean)
      .slice(0, 6)
      .join("  ·  ") || "—";

  // Image resolution.
  const gallery = (property.galleryUrls ?? []).filter(Boolean);
  const mainImageUrl = property.leadImageUrl?.trim() || gallery[0] || null;
  const thumbs = gallery.filter((u) => u !== mainImageUrl).slice(0, 3);

  const contents: Record<string, SlotContent> = {
    section_title: { kind: "text", value: sectionTitle },
    property_name: { kind: "text", value: propertyName },
    location_meta: { kind: "text", value: locationMeta },
    why_we_chose_this: { kind: "text", value: whyWeChoseThis },
    description: { kind: "text", value: description },
    stay_label: { kind: "text", value: "YOUR STAY" },
    stay_row_1_label: { kind: "text", value: stayRows[0].label },
    stay_row_1_value: { kind: "text", value: stayRows[0].value },
    stay_row_2_label: { kind: "text", value: stayRows[1].label },
    stay_row_2_value: { kind: "text", value: stayRows[1].value },
    stay_row_3_label: { kind: "text", value: stayRows[2].label },
    stay_row_3_value: { kind: "text", value: stayRows[2].value },
    stay_row_4_label: { kind: "text", value: stayRows[3].label },
    stay_row_4_value: { kind: "text", value: stayRows[3].value },
    stay_row_5_label: { kind: "text", value: stayRows[4].label },
    stay_row_5_value: { kind: "text", value: stayRows[4].value },
    amenities_label: { kind: "text", value: "AT A GLANCE" },
    amenities_list: { kind: "text", value: amenitiesList },
    main_image: { kind: "image", url: mainImageUrl, alt: propertyName },
    thumb_1: { kind: "image", url: thumbs[0] ?? null, alt: "" },
    thumb_2: { kind: "image", url: thumbs[1] ?? null, alt: "" },
    thumb_3: { kind: "image", url: thumbs[2] ?? null, alt: "" },
  };

  return (
    <PdfPage label={`Property ${index + 1} · ${propertyName}`} bleed>
      <div data-section-type="propertyShowcase" data-property-id={property.id} style={{ width: "100%", height: "100%" }}>
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
