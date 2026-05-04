"use client";

import type {
  Slot,
  TextSlot,
  ImageSlot,
  FillSlot,
  LineSlot,
  GroupSlot,
  VectorSlot,
} from "@/lib/pdfFit/types";
import { mm } from "@/lib/pdfFit/types";
import { styleCss, resolveColor } from "@/lib/pdfFit/typography";
import type { ThemeTokens, ProposalTheme } from "@/lib/types";

// ─── PdfFitSlot — the primitive renderer ──────────────────────────────────
//
// Takes one Slot manifest entry + the proposal's theme + the resolved
// content for that slot, returns an absolutely-positioned div at the
// slot's exact mm coordinates. Every PDF-Fit layout is just a stack of
// these.
//
// The slot's `name` is the binding key — the layout component decides
// what content lives in each named slot and passes it via the `content`
// param. Slot metadata (caps, alignment, color role) is honoured here so
// individual layout components stay declarative.

export type SlotContent =
  | { kind: "text"; value: string }
  | { kind: "image"; url: string | null; alt?: string }
  | { kind: "vector"; node: React.ReactNode }
  | { kind: "none" };

type Props = {
  slot: Slot;
  content?: SlotContent;
  theme: ProposalTheme;
  tokens: ThemeTokens;
};

export function PdfFitSlot({ slot, content, theme, tokens }: Props) {
  // Common position style — every slot type shares this.
  const position: React.CSSProperties = {
    position: "absolute",
    left: mm(slot.x_mm),
    top: mm(slot.y_mm),
    width: mm(slot.w_mm),
    height: mm(slot.h_mm),
    ...(slot.z_index !== undefined ? { zIndex: slot.z_index } : {}),
  };

  switch (slot.type) {
    case "text":
      return <TextRender slot={slot} content={content} theme={theme} tokens={tokens} position={position} />;
    case "image":
      return <ImageRender slot={slot} content={content} tokens={tokens} position={position} />;
    case "fill":
      return <FillRender slot={slot} tokens={tokens} position={position} />;
    case "line":
      return <LineRender slot={slot} tokens={tokens} position={position} />;
    case "group":
      return <GroupRender slot={slot} theme={theme} tokens={tokens} position={position} />;
    case "vector":
      return <VectorRender slot={slot} content={content} position={position} />;
  }
}

// ─── Text ──────────────────────────────────────────────────────────────────

function TextRender({
  slot, content, theme, tokens, position,
}: {
  slot: TextSlot;
  content: SlotContent | undefined;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  position: React.CSSProperties;
}) {
  const raw = content?.kind === "text" ? content.value : "";
  // Apply truncate behavior — caps + ellipsis. scale_down is left to
  // the layout-component author for now (hard to do robustly without
  // measuring text); truncate covers the common case.
  const displayed = (() => {
    if (!raw) return "";
    if (slot.max_chars && slot.overflow_behavior === "truncate" && raw.length > slot.max_chars) {
      return raw.slice(0, slot.max_chars - 1).trimEnd() + "…";
    }
    return raw;
  })();
  const styleProps = slot.style
    ? styleCss(slot.style, { displayFont: theme.displayFont, bodyFont: theme.bodyFont })
    : {};
  const color = slot.color_role
    ? resolveColor(slot.color_role, tokens)
    : tokens.bodyText;
  return (
    <div
      style={{
        ...position,
        color,
        textAlign: slot.alignment ?? "left",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        ...styleProps,
      }}
    >
      <span style={{ width: "100%", display: "block" }}>{displayed}</span>
    </div>
  );
}

// ─── Image ─────────────────────────────────────────────────────────────────

function ImageRender({
  slot, content, tokens, position,
}: {
  slot: ImageSlot;
  content: SlotContent | undefined;
  tokens: ThemeTokens;
  position: React.CSSProperties;
}) {
  const url = content?.kind === "image" ? content.url : null;
  if (!url) {
    // No-image case — render the slot as a soft fill so the slot
    // outline isn't a void. Doesn't render a visual placeholder
    // (operator brief: PDF should never show "no image" text).
    return (
      <div
        style={{
          ...position,
          background: tokens.cardBg,
          opacity: 0.55,
          overflow: "hidden",
        }}
      />
    );
  }
  return (
    <div style={{ ...position, overflow: "hidden", background: tokens.cardBg }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={content?.kind === "image" ? content.alt ?? "" : ""}
        style={{
          width: "100%",
          height: "100%",
          objectFit: slot.object_fit ?? "cover",
        }}
      />
    </div>
  );
}

// ─── Fill (solid / gradient panels) ────────────────────────────────────────

function FillRender({
  slot, tokens, position,
}: {
  slot: FillSlot;
  tokens: ThemeTokens;
  position: React.CSSProperties;
}) {
  // The fill value is either a ColorRole token or a raw CSS string.
  // Tokens get resolved; raw strings (gradients, hex) pass through.
  const fill = isColorRole(slot.fill)
    ? resolveColor(slot.fill, tokens)
    : slot.fill;
  return <div style={{ ...position, background: fill, pointerEvents: "none" }} />;
}

function isColorRole(value: string): value is import("@/lib/pdfFit/types").ColorRole {
  return [
    "pageBg", "sectionBg", "accent", "secondaryAccent",
    "headingText", "bodyText", "mutedText", "border",
    "white", "darkBg",
  ].includes(value);
}

// ─── Line (hairline divider) ──────────────────────────────────────────────

function LineRender({
  slot, tokens, position,
}: {
  slot: LineSlot;
  tokens: ThemeTokens;
  position: React.CSSProperties;
}) {
  const color = slot.color_role
    ? resolveColor(slot.color_role, tokens)
    : tokens.border;
  return <div style={{ ...position, background: color, pointerEvents: "none" }} />;
}

// ─── Group (sub-slots positioned relative) ────────────────────────────────

function GroupRender({
  slot, theme, tokens, position,
}: {
  slot: GroupSlot;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  position: React.CSSProperties;
}) {
  return (
    <div style={{ ...position }}>
      {(slot.slots ?? []).map((child) => (
        <PdfFitSlot key={child.name} slot={child} theme={theme} tokens={tokens} />
      ))}
    </div>
  );
}

// ─── Vector (SVG / route overlay) ──────────────────────────────────────────

function VectorRender({
  content, position,
}: {
  slot: VectorSlot;
  content: SlotContent | undefined;
  position: React.CSSProperties;
}) {
  if (content?.kind !== "vector") return null;
  return <div style={{ ...position, pointerEvents: "none" }}>{content.node}</div>;
}
