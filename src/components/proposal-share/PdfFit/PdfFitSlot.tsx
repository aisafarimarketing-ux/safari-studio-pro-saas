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
  | {
      kind: "image";
      url: string | null;
      alt?: string;
      /** CSS object-position string — drives the visible crop within
       *  the fixed slot frame. Format: "X% Y%" (e.g. "62% 38%").
       *  Defaults to "50% 50%" when absent. */
      objectPosition?: string;
      /** CSS transform scale applied inside the slot frame. 1 keeps
       *  the natural object-fit:cover crop; >1 zooms. Recommended
       *  range 1.0–2.0. Defaults to 1. */
      scale?: number;
    }
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
      <span style={{ width: "100%", display: "block", whiteSpace: "pre-line" }}>{displayed}</span>
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
    // Empty slot: render nothing so a missing image doesn't leave a
    // grey rectangle on the page. Operator-visible "missing image"
    // hints belong in the editor, not the printed deck.
    return null;
  }
  // Operator-controlled crop within the fixed slot frame. Defaults
  // to centre + 1× scale; stored on section.content as objectPosition
  // + scale so the editor's drag/zoom UI persists across saves and
  // print renders honour the same crop.
  const objectPosition =
    content?.kind === "image" && content.objectPosition
      ? content.objectPosition
      : "50% 50%";
  const scale =
    content?.kind === "image" &&
    typeof content.scale === "number" &&
    Number.isFinite(content.scale)
      ? Math.min(Math.max(content.scale, 0.5), 3)
      : 1;
  // Logo containment — every logo slot sits inside an auto-contrast
  // backdrop chip so the operator's logo (fixed colours) stays visible
  // regardless of the page background. Triggered by image_role==="logo"
  // OR slot.name including "logo". Hero / thumb / signature images
  // skip the chip and render edge-to-edge inside the slot.
  const isLogo =
    slot.image_role === "logo" ||
    slot.name === "operator_logo" ||
    slot.name === "logo_small";
  if (isLogo) {
    // Pick the chip backdrop based on the slot's resolved surface.
    // We use sectionSurface (white/cream) when the page surface is
    // dark-ish; otherwise a transparent chip so light pages don't
    // get a visible card behind the logo.
    const surfaceLuminance = relativeLuminance(tokens.sectionSurface);
    const chipBg =
      surfaceLuminance < 0.55 ? "rgba(255,255,255,0.92)" : "transparent";
    return (
      <div
        style={{
          ...position,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          background: chipBg,
          borderRadius: chipBg === "transparent" ? 0 : "2mm",
          padding: chipBg === "transparent" ? 0 : "1.5mm 3mm",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={content?.kind === "image" ? content.alt ?? "" : ""}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            objectPosition,
          }}
        />
      </div>
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
          objectPosition,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "center center",
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

// ─── Helpers ──────────────────────────────────────────────────────────────

// Compute the relative luminance (0..1) of a CSS colour string. Used
// by the logo-container auto-contrast logic to decide whether to paint
// a white chip behind the logo or let it sit on the page directly.
// Accepts hex (#rrggbb / #rgb) and rgb()/rgba() strings; returns 1 (treat
// as light) for unknown formats so the logo defaults to "no chip".
function relativeLuminance(colour: string | undefined | null): number {
  if (!colour) return 1;
  const rgb = parseColour(colour);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const sv = v / 255;
    return sv <= 0.03928 ? sv / 12.92 : Math.pow((sv + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColour(c: string): [number, number, number] | null {
  const trimmed = c.trim();
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
    if (hex.length !== 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  const m = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  return null;
}
