"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";
import { PERSONAL_NOTE_WEBSTYLE_FIXED } from "@/lib/pdfFit/manifests/personal_note";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit personal note ─────────────────────────────────────────────────
//
// Resolves the operator's letter content + signature + contact info
// against the personal_note manifest. Strips HTML so the body fits
// the plain-text slot.

type Props = { section: Section };

export function PdfFitPersonalNotePage({ section }: Props) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "default";

  // Body resolution — operator stores the letter text in
  // section.content.body. Combine opener / body / signOff into a
  // single block (joined with paragraph breaks) so the operator's
  // editorial structure survives the print pass.
  const opener = strField(section.content?.opener);
  const body = stripHtml(strField(section.content?.body) ?? "");
  const signOffLead = strField(section.content?.signOffLead);
  const signOff = strField(section.content?.signOff);
  const fullBody = [opener, body, signOffLead, signOff]
    .filter(Boolean)
    .join("\n\n");

  const operator = proposal.operator;
  const advisorName = operator?.consultantName?.trim() || "";
  const advisorTitle = operator?.consultantRole?.trim() || "";
  const advisorImageUrl = operator?.consultantPhoto?.trim() || null;
  const signatureUrl = operator?.signatureUrl?.trim() || null;
  const operatorLogoUrl = operator?.logoUrl?.trim() || null;
  const contactEmail = operator?.email?.trim() || "";
  const contactWhatsapp =
    operator?.whatsapp?.trim() || operator?.phone?.trim() || "";

  const contents: Record<string, SlotContent> = {
    main_text_block: { kind: "text", value: fullBody },
    signature_image: { kind: "image", url: signatureUrl, alt: "Signature" },
    advisor_name: { kind: "text", value: advisorName },
    advisor_title: { kind: "text", value: advisorTitle },
    advisor_image: { kind: "image", url: advisorImageUrl, alt: advisorName },
    contact_email: { kind: "text", value: contactEmail },
    contact_whatsapp: { kind: "text", value: contactWhatsapp },
    logo_small: { kind: "image", url: operatorLogoUrl, alt: "" },
  };

  return (
    <PdfPage label="Personal note" bleed>
      <div data-section-type="personalNote" style={{ width: "100%", height: "100%" }}>
        <PdfFitLayout
          manifest={PERSONAL_NOTE_WEBSTYLE_FIXED}
          contents={contents}
          theme={proposal.theme}
          tokens={tokens}
          variantId={variantId}
        />
      </div>
    </PdfPage>
  );
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
