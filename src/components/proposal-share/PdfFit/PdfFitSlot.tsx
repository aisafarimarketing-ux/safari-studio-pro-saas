"use client";

import { useEditorStore } from "@/store/editorStore";
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
      /** Editor callback — when present and the editor store is in
       *  "editor" mode, the image becomes draggable inside its frame
       *  (mouse drag → objectPosition; wheel → scale). The callback
       *  receives the new values; the consumer persists them. */
      onCropChange?: (position: string, scale: number) => void;
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
      {/* Single-line slots (height ≤ 8mm or scale_down behaviour) keep
          their text on one line and let the slot's overflow:hidden +
          text-overflow:ellipsis trim the tail. Multi-line slots honour
          newlines via pre-line. This stops a long destinations string
          from wrapping into a second line that gets clipped. */}
      <span
        style={{
          width: "100%",
          display: "block",
          whiteSpace:
            slot.h_mm <= 8 || slot.overflow_behavior === "scale_down"
              ? "nowrap"
              : "pre-line",
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
      >
        {displayed}
      </span>
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
  // Logo treatment — minimal and editorial per spec. No chip, no
  // shadow, no card. Logo sits transparent inside its slot; the
  // operator picks a contrasting page surface (or swaps to a
  // mono variant) when imagery requires it.
  const isLogo =
    slot.image_role === "logo" ||
    slot.name === "operator_logo" ||
    slot.name === "logo_small" ||
    slot.name === "note_company_logo";
  if (isLogo) {
    return (
      <div
        style={{
          ...position,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          background: "transparent",
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
  const onCropChange =
    content?.kind === "image" ? content.onCropChange : undefined;
  return (
    <DraggableImage
      url={url}
      alt={content?.kind === "image" ? content.alt ?? "" : ""}
      slot={slot}
      tokens={tokens}
      position={position}
      objectPosition={objectPosition}
      scale={scale}
      filter={adjustment.imageFilter}
      onCropChange={onCropChange}
    />
  );
}

// ─── Draggable image — repositions the visible crop inside its frame ──
//
// When onCropChange is provided AND the editor store is in editor
// mode, the image becomes draggable inside the slot's frame. Mouse
// drag adjusts the object-position percentages; wheel adjusts the
// transform scale. Persistence is the caller's responsibility — we
// just emit the new values via onCropChange.
function DraggableImage({
  url, alt, slot, tokens, position, objectPosition, scale, filter, onCropChange,
}: {
  url: string;
  alt: string;
  slot: ImageSlot;
  tokens: ThemeTokens;
  position: React.CSSProperties;
  objectPosition: string;
  scale: number;
  filter?: string;
  onCropChange?: (position: string, scale: number) => void;
}) {
  const editorMode = useEditorStore((s) => s.mode);
  const draggable = editorMode === "editor" && Boolean(onCropChange);

  const containerStyle: React.CSSProperties = {
    ...position,
    overflow: "hidden",
    background: tokens.cardBg,
    cursor: draggable ? "grab" : undefined,
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!draggable || !onCropChange) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const [startPosX, startPosY] = parseObjectPosition(objectPosition);
    const target = e.currentTarget as HTMLElement;
    target.style.cursor = "grabbing";
    const rect = target.getBoundingClientRect();
    const onMove = (m: MouseEvent) => {
      const dx = m.clientX - startX;
      const dy = m.clientY - startY;
      // Map cursor delta (in container pixels) to object-position
      // percent. Inverse direction so dragging RIGHT moves the image
      // right (i.e. reveals more of the LEFT side of the source =
      // smaller objectPosition X%).
      const newX = clamp(startPosX - (dx / rect.width) * 100, 0, 100);
      const newY = clamp(startPosY - (dy / rect.height) * 100, 0, 100);
      onCropChange(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`, scale);
    };
    const onUp = () => {
      target.style.cursor = "grab";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!draggable || !onCropChange) return;
    e.preventDefault();
    e.stopPropagation();
    const next = clamp(scale + (e.deltaY < 0 ? 0.1 : -0.1), 1, 3);
    onCropChange(objectPosition, parseFloat(next.toFixed(2)));
  };

  return (
    <div style={containerStyle} onMouseDown={onMouseDown} onWheel={onWheel}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: slot.object_fit ?? "cover",
          objectPosition,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "center center",
          userSelect: "none",
          pointerEvents: "none",
          ...(filter ? { filter } : {}),
        }}
      />
    </div>
  );
}

function parseObjectPosition(p: string): [number, number] {
  const m = p.match(/(-?\d+(?:\.\d+)?)\s*%\s+(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) return [50, 50];
  return [parseFloat(m[1]), parseFloat(m[2])];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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

