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
import { styleCss, resolveColor, TYPOGRAPHY_STYLES } from "@/lib/pdfFit/typography";
import { snapWeight, type SlotAdjustment } from "@/lib/pdfFit/variants";
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
  /** Variant-resolved adjustment for this slot. The layout container
   *  resolves the variant id once and passes per-slot adjustments
   *  through; PdfFitSlot here just applies them. Empty object when
   *  no variant is in play (base styling). */
  adjustment?: SlotAdjustment;
  /** Optional content map. When present, group sub-slots resolve
   *  their content from this map by child slot name. Top-level slots
   *  use the explicit `content` prop instead. */
  contents?: Record<string, SlotContent>;
};

export function PdfFitSlot({ slot, content, theme, tokens, adjustment = {}, contents }: Props) {
  // Common position style — every slot type shares this. Position is
  // never adjusted by variants (locked per spec).
  const position: React.CSSProperties = {
    position: "absolute",
    left: mm(slot.x_mm),
    top: mm(slot.y_mm),
    width: mm(slot.w_mm),
    height: mm(slot.h_mm),
    ...(slot.z_index !== undefined ? { zIndex: slot.z_index } : {}),
    ...(adjustment.opacity !== undefined ? { opacity: adjustment.opacity } : {}),
  };

  switch (slot.type) {
    case "text":
      return <TextRender slot={slot} content={content} theme={theme} tokens={tokens} position={position} adjustment={adjustment} />;
    case "image":
      return <ImageRender slot={slot} content={content} tokens={tokens} position={position} adjustment={adjustment} />;
    case "fill":
      return <FillRender slot={slot} tokens={tokens} position={position} adjustment={adjustment} />;
    case "line":
      return <LineRender slot={slot} tokens={tokens} position={position} />;
    case "group":
      return <GroupRender slot={slot} theme={theme} tokens={tokens} position={position} contents={contents} />;
    case "vector":
      return <VectorRender slot={slot} content={content} position={position} />;
  }
}

// ─── Text ──────────────────────────────────────────────────────────────────

function TextRender({
  slot, content, theme, tokens, position, adjustment,
}: {
  slot: TextSlot;
  content: SlotContent | undefined;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  position: React.CSSProperties;
  adjustment: SlotAdjustment;
}) {
  const raw = content?.kind === "text" ? content.value : "";
  const displayed = (() => {
    if (!raw) return "";
    if (slot.max_chars && slot.overflow_behavior === "truncate" && raw.length > slot.max_chars) {
      return raw.slice(0, slot.max_chars - 1).trimEnd() + "…";
    }
    return raw;
  })();
  // Effective style starts from the slot's declared style (or "body"
  // default), then variant overrides may swap to a different style
  // entirely.
  const effectiveStyle = adjustment.styleOverride ?? slot.style;
  const baseStyleProps = effectiveStyle
    ? styleCss(effectiveStyle, { displayFont: theme.displayFont, bodyFont: theme.bodyFont })
    : {};
  // Apply scalar variant adjustments on top of the resolved base.
  // sizeScale multiplies font-size; leadingScale multiplies
  // line-height; weightScale snaps to nearest valid CSS weight;
  // letterSpacingDelta adds to base tracking.
  const tunedStyleProps: React.CSSProperties = { ...baseStyleProps };
  if (effectiveStyle && adjustment.sizeScale !== undefined) {
    const baseSize = TYPOGRAPHY_STYLES[effectiveStyle].size_pt;
    tunedStyleProps.fontSize = `${baseSize * adjustment.sizeScale}pt`;
  }
  if (effectiveStyle && adjustment.leadingScale !== undefined) {
    const baseLeading = TYPOGRAPHY_STYLES[effectiveStyle].leading;
    tunedStyleProps.lineHeight = baseLeading * adjustment.leadingScale;
  }
  if (effectiveStyle && adjustment.weightScale !== undefined) {
    const baseWeight = TYPOGRAPHY_STYLES[effectiveStyle].weight;
    tunedStyleProps.fontWeight = snapWeight(baseWeight, adjustment.weightScale);
  }
  if (adjustment.letterSpacingDelta !== undefined) {
    const base = effectiveStyle
      ? TYPOGRAPHY_STYLES[effectiveStyle].letterSpacing_em ?? 0
      : 0;
    tunedStyleProps.letterSpacing = `${base + adjustment.letterSpacingDelta}em`;
  }
  // Color: variant override beats slot default.
  const colorRole = adjustment.colorOverride ?? slot.color_role;
  const color = colorRole ? resolveColor(colorRole, tokens) : tokens.bodyText;
  return (
    <div
      style={{
        ...position,
        color,
        textAlign: slot.alignment ?? "left",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        ...tunedStyleProps,
      }}
    >
      <span style={{ width: "100%", display: "block" }}>{displayed}</span>
    </div>
  );
}

// ─── Image ─────────────────────────────────────────────────────────────────

function ImageRender({
  slot, content, tokens, position, adjustment,
}: {
  slot: ImageSlot;
  content: SlotContent | undefined;
  tokens: ThemeTokens;
  position: React.CSSProperties;
  adjustment: SlotAdjustment;
}) {
  const url = content?.kind === "image" ? content.url : null;
  if (!url) {
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
          // Variant-driven CSS filter — e.g. saturate(1.1) contrast(1.05)
          // for "image_lead" treatments. No-op when not specified.
          ...(adjustment.imageFilter ? { filter: adjustment.imageFilter } : {}),
        }}
      />
    </div>
  );
}

// ─── Fill (solid / gradient panels) ────────────────────────────────────────

function FillRender({
  slot, tokens, position, adjustment,
}: {
  slot: FillSlot;
  tokens: ThemeTokens;
  position: React.CSSProperties;
  adjustment: SlotAdjustment;
}) {
  // Variant fillOverride wins over the slot's declared fill (e.g.
  // "stronger gradient" variant swaps the gradient stops). Otherwise
  // resolve the slot's fill: ColorRole tokens get the theme value;
  // raw CSS strings (gradient / hex) pass through.
  const rawFill = adjustment.fillOverride ?? slot.fill;
  const fill = isColorRole(rawFill)
    ? resolveColor(rawFill, tokens)
    : rawFill;
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
  slot, theme, tokens, position, contents,
}: {
  slot: GroupSlot;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  position: React.CSSProperties;
  contents?: Record<string, SlotContent>;
}) {
  return (
    <div style={{ ...position }}>
      {(slot.slots ?? []).map((child) => (
        <PdfFitSlot
          key={child.name}
          slot={child}
          content={contents?.[child.name]}
          contents={contents}
          theme={theme}
          tokens={tokens}
        />
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
