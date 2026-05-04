"use client";

import { useProposalStore } from "@/store/proposalStore";
import { resolveTokens } from "@/lib/theme";
import type { Section, PracticalCard } from "@/lib/types";
import {
  PRACTICAL_INFO_CARDS,
  PRACTICAL_INFO_CARDS_PER_PAGE,
  PRACTICAL_INFO_LAYOUTS,
} from "@/lib/pdfFit/manifests/practical_info";
import { PdfFitLayout } from "./PdfFitLayout";
import { PdfPage } from "../PdfPage";
import type { SlotContent } from "./PdfFitSlot";

// ─── PDF-Fit practical info ────────────────────────────────────────────────
//
// Chunks proposal.practicalInfo into pages of CARDS_PER_PAGE entries
// and renders one PdfPage per chunk. Continuation pages get a part
// label appended to the section subtitle so the operator can see the
// split at a glance.

type Props = { section: Section };

export function PdfFitPracticalInfoPages({ section }: Props) {
  const { proposal } = useProposalStore();
  const cards = proposal.practicalInfo ?? [];
  if (cards.length === 0) return null;

  const chunks: PracticalCard[][] = [];
  for (let i = 0; i < cards.length; i += PRACTICAL_INFO_CARDS_PER_PAGE) {
    chunks.push(cards.slice(i, i + PRACTICAL_INFO_CARDS_PER_PAGE));
  }
  const total = chunks.length;
  return (
    <>
      {chunks.map((chunk, idx) => (
        <PdfFitPracticalInfoPage
          key={idx}
          section={section}
          cards={chunk}
          partLabel={total > 1 ? ` — Part ${idx + 1} of ${total}` : ""}
        />
      ))}
    </>
  );
}

function PdfFitPracticalInfoPage({
  section, cards, partLabel,
}: {
  section: Section;
  cards: PracticalCard[];
  partLabel: string;
}) {
  const { proposal } = useProposalStore();
  const tokens = resolveTokens(proposal.theme.tokens, section.styleOverrides);

  const variantId =
    typeof section.content?.variantId === "string"
      ? section.content.variantId
      : "default";

  const manifest =
    PRACTICAL_INFO_LAYOUTS.find((l) => l.id === section.layoutVariant) ??
    PRACTICAL_INFO_CARDS;

  const sectionTitle =
    (typeof section.content?.title === "string" && section.content.title.trim()) ||
    "Practical information";
  const sectionSubtitle =
    (typeof section.content?.subtitle === "string" && section.content.subtitle.trim()) ||
    "Good to know" + partLabel;

  const contents: Record<string, SlotContent> = {
    section_title: { kind: "text", value: sectionTitle + partLabel },
    section_subtitle: { kind: "text", value: sectionSubtitle },
  };

  // Pad to CARDS_PER_PAGE so missing cards don't leave their backdrops
  // floating empty: instead, we omit the corresponding fills from the
  // contents map and skip the group's content fields. The manifest's
  // backdrops still draw — we override their fill via slot data so
  // unused slots stay visually clean (transparent).
  for (let i = 0; i < PRACTICAL_INFO_CARDS_PER_PAGE; i++) {
    const card = cards[i];
    const n = i + 1;
    if (!card) {
      // Hide the backdrop for unused slots by overriding to pageBg
      // (no visible card). The group's text slots stay empty.
      contents[`card_${n}_bg`] = { kind: "none" };
      continue;
    }
    contents[`card_${n}_icon`] = {
      kind: "text",
      value: card.icon ?? "",
    };
    contents[`card_${n}_title`] = { kind: "text", value: card.title };
    contents[`card_${n}_body`] = { kind: "text", value: card.body };
  }

  return (
    <PdfPage label="Practical information" bleed>
      <div data-section-type="practicalInfo" style={{ width: "100%", height: "100%" }}>
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
