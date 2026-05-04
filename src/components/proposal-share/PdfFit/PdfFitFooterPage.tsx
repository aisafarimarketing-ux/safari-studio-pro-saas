"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";
import { FOOTER_CONTACT_CARD } from "@/lib/pdfFit/manifests/footer";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit footer / contact card page ───────────────────────────────────
//
// Final reference card — operator logo, contact rows, brand line.
// Smaller emotional weight than the closing page (which sits before
// it); this page is the leave-behind directory.

type Props = { section: Section };

export function PdfFitFooterPage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "default";

  const operator = proposal.operator;
  const operatorLogoUrl = operator?.logoUrl?.trim() || null;
  const companyName = operator?.companyName?.trim() || "";
  const tagline =
    str(section.content?.tagline) ??
    str(section.content?.subtitle) ??
    `Plan · Book · Travel — with ${operator?.consultantName?.trim() || "us"}`;

  const addressBlock = [operator?.address, operator?.country]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" · ");

  const emailRow = operator?.email?.trim() ? `Email · ${operator.email.trim()}` : "";
  const phoneRow = operator?.phone?.trim() ? `Phone · ${operator.phone.trim()}` : "";
  const whatsappRow = operator?.whatsapp?.trim()
    ? `WhatsApp · ${operator.whatsapp.trim()}`
    : "";
  const websiteRow = operator?.website?.trim()
    ? `Web · ${stripScheme(operator.website.trim())}`
    : "";

  const closingLine =
    str(section.content?.closingLine) ??
    "Thank you for letting us craft this safari for you. We can't wait to welcome you on the road.";

  const brandLine =
    str(section.content?.brandLine) ??
    `${companyName}${operator?.country ? ` · ${operator.country}` : ""}`;

  const contents: Record<string, SlotContent> = {
    operator_logo: { kind: "image", url: operatorLogoUrl, alt: companyName },
    company_name: { kind: "text", value: companyName },
    tagline: { kind: "text", value: tagline },
    address_block: { kind: "text", value: addressBlock },
    email_row: { kind: "text", value: emailRow },
    phone_row: { kind: "text", value: phoneRow },
    whatsapp_row: { kind: "text", value: whatsappRow },
    website_row: { kind: "text", value: websiteRow },
    closing_line: { kind: "text", value: closingLine },
    brand_line: { kind: "text", value: brandLine },
  };

  return (
    <PdfPage label="Contact" bleed>
      <div data-section-type="footer" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={FOOTER_CONTACT_CARD}
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
