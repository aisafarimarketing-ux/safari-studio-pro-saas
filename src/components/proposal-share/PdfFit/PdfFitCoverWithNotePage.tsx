"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { SectionChrome } from "@/components/editor/SectionChrome";
import type { Section } from "@/lib/types";
import {
  COVER_HALF_S64L,
  PERSONAL_NOTE_HALF,
} from "@/lib/pdfFit/manifests/cover_combined";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit combined cover + personal note page ─────────────────────────
//
// Per spec — ONE A4 page with TWO fixed sections stacked:
//   COVER          y 0   → 150mm
//   PERSONAL NOTE  y 150 → 297mm
//
// Each half mounts its own PdfFitLayout at its declared sub-height.
// In editor mode each half is wrapped in its own SectionChrome bound
// to the right section so hover / click controls operate independently
// — deleting cover does not move the note; deleting note does not
// move the cover (the empty half stays as 0mm of nothing).

type Props = {
  coverSection: Section;
  noteSection: Section;
};

export function PdfFitCoverWithNotePage({ coverSection, noteSection }: Props) {
  const { proposal } = useProposalStore();
  const mode = useEditorStore((s) => s.mode);

  return (
    <PdfPage label="Cover · Personal note" bleed>
      <div
        data-section-type="coverWithNote"
        style={{
          position: "relative",
          width: "210mm",
          height: "297mm",
          overflow: "hidden",
        }}
      >
        {/* Cover half — y 0–150mm */}
        <ChromedHalf
          section={coverSection}
          mode={mode}
          y={0}
          h={150}
          visible={coverSection.visible}
        >
          <CoverHalfContents section={coverSection} />
        </ChromedHalf>

        {/* Personal note half — y 150–297mm */}
        <ChromedHalf
          section={noteSection}
          mode={mode}
          y={150}
          h={147}
          visible={noteSection.visible}
        >
          <NoteHalfContents section={noteSection} proposalId={proposal.id} />
        </ChromedHalf>
      </div>
    </PdfPage>
  );
}

// ─── Half wrapper — absolute-positioned chrome zone ──────────────────────
//
// In editor mode each half is wrapped in SectionChrome bound to its
// own section so hover / picker / drag / delete buttons fire on the
// correct section. In preview / print modes we just render the
// children. The half occupies y → y+h on the page; positions are
// absolute so the two halves never affect each other's layout.

function ChromedHalf({
  section,
  mode,
  y,
  h,
  visible,
  children,
}: {
  section: Section;
  mode: string;
  y: number;
  h: number;
  visible: boolean;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  const halfStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: `${y}mm`,
    width: "210mm",
    height: `${h}mm`,
    overflow: "hidden",
  };
  if (mode !== "editor") {
    return <div style={halfStyle}>{children}</div>;
  }
  // Editor mode — chrome goes inside the absolute box so hover events
  // and picker pop-overs land on the correct half.
  return (
    <div style={halfStyle}>
      <SectionChrome section={section}>{children}</SectionChrome>
    </div>
  );
}

// ─── Cover half contents ─────────────────────────────────────────────────

function CoverHalfContents({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  // 7 mandatory backend fields (spec).
  const tripTitle =
    proposal.metadata?.title?.trim() ||
    proposal.trip?.title?.trim() ||
    "Your safari";

  const tripDestinations = (proposal.trip?.destinations ?? [])
    .filter((s) => Boolean(s?.trim()))
    .join("  ·  ");

  const clientName = proposal.client?.guestNames?.trim() || "";
  const dates = proposal.trip?.dates?.trim() || "";

  const nights = numField(proposal.trip?.nights);
  const durationLine = nights
    ? `${nights + 1} days and ${nights} ${nights === 1 ? "night" : "nights"}`
    : "";

  const adults = numField(proposal.client?.adults);
  const children = numField(proposal.client?.children) ?? 0;
  const partyLine = (() => {
    if (!adults && !children) return proposal.client?.pax?.trim() || "";
    const adultsLabel =
      adults && adults > 0
        ? `${adults} ${adults === 1 ? "adult" : "adults"}`
        : "";
    const childrenLabel =
      children && children > 0
        ? `${children} ${children === 1 ? "child" : "children"}`
        : "";
    return [adultsLabel, childrenLabel].filter(Boolean).join(", ");
  })();

  const operatorLogoUrl = proposal.operator?.logoUrl?.trim() || null;

  const heroImageUrl =
    (section.content?.heroImageUrl as string | undefined)?.trim() ||
    proposal.trip?.stops?.[0]?.heroImageUrl?.trim() ||
    operatorLogoUrl ||
    null;

  const heroImagePosition =
    (section.content?.heroImagePosition as string | undefined) || "50% 50%";
  const heroImageScale = (() => {
    const v = section.content?.heroImageScale;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 3) {
      return v;
    }
    return 1;
  })();

  const contents: Record<string, SlotContent> = {
    hero_image: {
      kind: "image",
      url: heroImageUrl,
      alt: tripTitle,
      objectPosition: heroImagePosition,
      scale: heroImageScale,
    },
    operator_logo: { kind: "image", url: operatorLogoUrl, alt: "" },
    trip_title: { kind: "text", value: tripTitle },
    trip_destinations: { kind: "text", value: tripDestinations },
    meta_for_label: { kind: "text", value: "FOR" },
    meta_for_value: { kind: "text", value: clientName },
    meta_dates_label: { kind: "text", value: "DATES" },
    meta_dates_value: { kind: "text", value: dates },
    meta_duration_label: { kind: "text", value: "DURATION" },
    meta_duration_value: { kind: "text", value: durationLine },
    meta_party_label: { kind: "text", value: "PARTY" },
    meta_party_value: { kind: "text", value: partyLine },
  };

  return (
    <PdfFitLayout
      manifest={COVER_HALF_S64L}
      contents={contents}
      theme={proposal.theme}
      tokens={tokens}
      heightMm={150}
    />
  );
}

// ─── Personal note half contents ─────────────────────────────────────────

function NoteHalfContents({
  section,
}: {
  section: Section;
  proposalId: string;
}) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const opener = strField(section.content?.opener);
  const body = stripHtml(strField(section.content?.body) ?? "");
  const signOff = strField(section.content?.signOff);
  const greeting = opener ?? "Karibu —";
  const fullBody = [body, signOff].filter(Boolean).join("\n\n");

  const operator = proposal.operator;
  const advisorName = operator?.consultantName?.trim() || "";
  const advisorRole = operator?.consultantRole?.trim() || "";
  const advisorImageUrl = operator?.consultantPhoto?.trim() || null;
  const signatureUrl = operator?.signatureUrl?.trim() || null;
  const operatorLogoUrl = operator?.logoUrl?.trim() || null;

  const emailValue = operator?.email?.trim() || "";
  const whatsappValue = operator?.whatsapp?.trim() || operator?.phone?.trim() || "";

  const contents: Record<string, SlotContent> = {
    note_greeting: { kind: "text", value: greeting },
    note_body: { kind: "text", value: fullBody },
    note_signature: { kind: "image", url: signatureUrl, alt: "Signature" },
    note_advisor_name: { kind: "text", value: advisorName },
    note_advisor_role: { kind: "text", value: advisorRole },
    note_advisor_image: { kind: "image", url: advisorImageUrl, alt: advisorName },
    note_email_label: { kind: "text", value: "EMAIL" },
    note_email_value: { kind: "text", value: emailValue },
    note_whatsapp_label: { kind: "text", value: "WHATSAPP" },
    note_whatsapp_value: { kind: "text", value: whatsappValue },
    note_company_logo: { kind: "image", url: operatorLogoUrl, alt: "" },
  };

  return (
    <PdfFitLayout
      manifest={PERSONAL_NOTE_HALF}
      contents={contents}
      theme={proposal.theme}
      tokens={tokens}
      heightMm={147}
    />
  );
}

function strField(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function numField(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return undefined;
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
