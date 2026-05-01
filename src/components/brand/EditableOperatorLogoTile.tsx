"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OperatorLogoTile } from "./OperatorLogoTile";
import { removeLogoBackground } from "@/lib/removeLogoBackground";
import { uploadImage } from "@/lib/uploadImage";

// ─── EditableOperatorLogoTile ──────────────────────────────────────────
//
// Editor-only wrapper around OperatorLogoTile. Shows a small "Edit logo"
// affordance on hover; clicking it opens a dropdown with two actions:
//
//   1. Replace / Remove background — both write back through onLogoChange
//      so the parent persists the new URL. Sections route this callback
//      to updateOperator({ logoUrl }) so a single upload propagates to
//      every section that renders a logo (cover, header, personal note,
//      footer). Brand DNA at the user level is unaffected.
//
//   2. Tile colour — picks the colour of the rounded tile behind the
//      logo. Default "Auto" lets brightness detection choose between
//      cream and charcoal. Tile colour stays per-section (cover may
//      want cream, footer charcoal); only the logo URL is shared.
//
// The dropdown menu is portal'd to document.body so it escapes any
// overflow:hidden parent (the cover variants frequently clip their
// children to the hero photo's bounds). Same with the floating "Edit"
// pill — it positions itself via getBoundingClientRect each render.
//
// In non-editor mode this component is a transparent pass-through to
// OperatorLogoTile — clients see exactly what they would have seen,
// no editor chrome leaks into the share view.

const PRESET_SWATCHES: Array<{ label: string; value: string }> = [
  { label: "Cream", value: "rgba(245, 232, 216, 0.92)" },
  { label: "White", value: "rgba(255, 255, 255, 0.94)" },
  { label: "Sand", value: "rgba(229, 215, 195, 0.92)" },
  { label: "Charcoal", value: "rgba(26, 26, 26, 0.88)" },
  { label: "Teal", value: "rgba(31, 58, 58, 0.92)" },
  { label: "Black", value: "rgba(0, 0, 0, 0.85)" },
];

type Props = {
  logoUrl?: string;
  companyName?: string;
  className?: string;
  logoHeight?: number;
  isEditor?: boolean;
  /** Render the logo with no tile chrome. The hover editor still
   *  appears, but the tile-colour picker hides since there's no tile
   *  to colour. Used in Personal Note bottom strip + Footer. */
  bare?: boolean;
  /** Per-proposal tile colour override. */
  tileBgOverride?: string;
  /** Forward to OperatorLogoTile — see its prop docstring. The cover
   *  uses ~160 so the tile reads as a horizontal rectangle even with
   *  a square monogram. */
  minTileWidth?: number;
  /** Called when the cleaned/replaced logo URL changes. Operators
   *  upload once on any logo tile and the proposal's
   *  `operator.logoUrl` updates — every section that reads it
   *  re-renders together. */
  onLogoChange?: (url: string | undefined) => void;
  /** Called when the tile colour changes (undefined = back to auto). */
  onTileColorChange?: (color: string | undefined) => void;
};

export function EditableOperatorLogoTile(props: Props) {
  const {
    isEditor,
    logoUrl,
    companyName,
    className,
    logoHeight,
    bare,
    tileBgOverride,
    minTileWidth,
    onLogoChange,
    onTileColorChange,
  } = props;

  // Pass-through in client / share view — no editor chrome.
  if (!isEditor) {
    return (
      <OperatorLogoTile
        logoUrl={logoUrl}
        companyName={companyName}
        className={className}
        logoHeight={logoHeight}
        tileBgOverride={tileBgOverride}
        bare={bare}
        minTileWidth={minTileWidth}
      />
    );
  }

  return (
    <EditableInner
      logoUrl={logoUrl}
      companyName={companyName}
      className={className}
      logoHeight={logoHeight}
      bare={bare}
      tileBgOverride={tileBgOverride}
      minTileWidth={minTileWidth}
      onLogoChange={onLogoChange}
      onTileColorChange={onTileColorChange}
    />
  );
}

// All the editor-only state lives here so we don't pay for refs / effects
// in the share-view render path.
function EditableInner({
  logoUrl,
  companyName,
  className,
  logoHeight,
  bare,
  tileBgOverride,
  minTileWidth,
  onLogoChange,
  onTileColorChange,
}: Omit<Props, "isEditor">) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  // Track the tile's screen position so the portal'd toolbar/menu can
  // position themselves correctly. Recompute on hover/scroll/resize.
  useEffect(() => {
    if (!hover && !menuOpen) return;
    const recompute = () => {
      if (wrapRef.current) setAnchor(wrapRef.current.getBoundingClientRect());
    };
    recompute();
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [hover, menuOpen]);

  async function handleRemoveBackground() {
    if (!logoUrl || !onLogoChange) return;
    setRemoving(true);
    setProgress(0);
    setError(null);
    try {
      const { dataUrl } = await removeLogoBackground(logoUrl, (loaded, total) => {
        setProgress(total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0);
      });
      // Push through upload pipeline so the cleaned PNG ends up on
      // Supabase Storage rather than a multi-MB data URL embedded in
      // the proposal JSON.
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "logo-cleaned.png", { type: "image/png" });
      const url = await uploadImage(file, { maxDimension: 800 });
      onLogoChange(url);
      setMenuOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove background");
    } finally {
      setRemoving(false);
    }
  }

  function handlePickColor(color: string | undefined) {
    onTileColorChange?.(color);
  }

  // Replace logo — open a file picker, push the chosen file through
  // the existing upload pipeline, save the resulting URL as a per-
  // proposal override (the same channel as Remove background).
  function handleReplaceLogo() {
    if (!onLogoChange) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.svg";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file, { maxDimension: 800 });
        onLogoChange(url);
        setMenuOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't upload logo");
      }
    };
    input.click();
  }

  const showFloating = (hover || menuOpen) && !!anchor;

  return (
    <>
      <div
        ref={wrapRef}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="inline-block relative"
      >
        {logoUrl || companyName ? (
          <OperatorLogoTile
            logoUrl={logoUrl}
            companyName={companyName}
            className={className}
            logoHeight={logoHeight}
            tileBgOverride={tileBgOverride}
            bare={bare}
            minTileWidth={minTileWidth}
          />
        ) : (
          // Empty state — operator has no global logo and no override.
          // Click anywhere on this slot to open the file picker; the
          // upload lands as a per-section override (same channel as
          // "Replace logo"). Sized to roughly match logoHeight so the
          // placeholder doesn't disrupt the surrounding layout.
          <button
            type="button"
            onClick={handleReplaceLogo}
            className="flex items-center justify-center text-[10.5px] uppercase tracking-[0.22em] font-semibold text-black/40 hover:text-black/70 hover:border-black/30 transition cursor-pointer"
            style={{
              minHeight: (logoHeight ?? 44) + 14,
              minWidth: 92,
              padding: "8px 14px",
              border: "1px dashed rgba(0,0,0,0.2)",
              borderRadius: 6,
              background: "rgba(0,0,0,0.02)",
            }}
          >
            + Add logo
          </button>
        )}
        {removing && (
          <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-white/85 backdrop-blur-sm pointer-events-none">
            <div className="text-[11px] font-semibold text-black/70 tabular-nums">
              {progress}%
            </div>
          </div>
        )}
      </div>

      {showFloating &&
        createPortal(
          <FloatingChrome
            anchor={anchor!}
            menuOpen={menuOpen}
            onToggleMenu={() => setMenuOpen((v) => !v)}
            onCloseMenu={() => setMenuOpen(false)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onRemoveBackground={handleRemoveBackground}
            onReplaceLogo={handleReplaceLogo}
            onPickColor={handlePickColor}
            tileBgOverride={tileBgOverride}
            removing={removing}
            error={error}
            hasLogo={!!logoUrl}
            showTileColour={!bare}
          />,
          document.body,
        )}
    </>
  );
}

// ─── Floating chrome (button + menu) ─────────────────────────────────────

function FloatingChrome({
  anchor,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onMouseEnter,
  onMouseLeave,
  onRemoveBackground,
  onReplaceLogo,
  onPickColor,
  tileBgOverride,
  removing,
  error,
  hasLogo,
  showTileColour,
}: {
  anchor: DOMRect;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onRemoveBackground: () => void;
  onReplaceLogo: () => void;
  onPickColor: (color: string | undefined) => void;
  tileBgOverride?: string;
  removing: boolean;
  error: string | null;
  hasLogo: boolean;
  showTileColour: boolean;
}) {
  // Edit pill sits at top-right of the tile.
  const pillStyle: React.CSSProperties = {
    position: "fixed",
    top: anchor.top - 10,
    left: anchor.right - 64,
    zIndex: 10000,
  };
  // Menu drops below the tile, left-aligned. Clamp inside the viewport
  // so it doesn't get cut off when the cover is near the right edge.
  const MENU_W = 240;
  const menuLeft = Math.max(
    8,
    Math.min(anchor.left, window.innerWidth - MENU_W - 8),
  );
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: anchor.bottom + 6,
    left: menuLeft,
    width: MENU_W,
    zIndex: 10001,
  };

  return (
    <>
      <button
        type="button"
        onClick={onToggleMenu}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={pillStyle}
        className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold bg-black/80 text-white hover:bg-black transition shadow-lg backdrop-blur-sm flex items-center gap-1.5"
        title="Edit logo"
      >
        <span aria-hidden>✎</span>
        Edit logo
      </button>

      {menuOpen && (
        <>
          {/* Click-away catcher */}
          <div
            onClick={onCloseMenu}
            style={{ position: "fixed", inset: 0, zIndex: 10000 }}
          />
          <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={menuStyle}
            className="bg-white rounded-xl shadow-2xl border border-black/10 overflow-hidden"
          >
            {/* Replace logo — file picker, saves to per-section override.
                Always available so operators can swap the logo for this
                proposal without going to Brand DNA settings. */}
            <button
              type="button"
              onClick={onReplaceLogo}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-left hover:bg-black/4 transition"
            >
              <span aria-hidden>📷</span>
              {hasLogo ? "Replace logo…" : "Upload logo…"}
            </button>

            {/* Remove background — only when there's a logo to clean. */}
            {hasLogo && (
              <button
                type="button"
                onClick={onRemoveBackground}
                disabled={removing}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] text-left hover:bg-black/4 transition disabled:opacity-50 border-t border-black/6"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>✨</span>
                  Remove background
                </span>
                <span className="text-[10px] uppercase tracking-wider text-black/35">
                  {removing ? "Working…" : "ML"}
                </span>
              </button>
            )}

            {error && (
              <div className="px-3.5 py-2 text-[11px] text-[#b34334] border-t border-black/6 bg-[#b34334]/5">
                {error}
              </div>
            )}

            {/* Tile colour — hidden when the logo renders bare (no tile
                to colour). Brightness detection still drives the
                wordmark fallback colour silently. */}
            {showTileColour && (
              <div className="border-t border-black/6 px-3.5 py-3">
                <div className="text-[10px] uppercase tracking-wider text-black/40 mb-2 font-semibold">
                  Tile colour
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Swatch
                    label="Auto"
                    selected={!tileBgOverride}
                    onClick={() => onPickColor(undefined)}
                    isAuto
                  />
                  {PRESET_SWATCHES.map((s) => (
                    <Swatch
                      key={s.value}
                      label={s.label}
                      color={s.value}
                      selected={tileBgOverride === s.value}
                      onClick={() => onPickColor(s.value)}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="color"
                    value={hexFromColor(tileBgOverride) || "#f5e8d8"}
                    onChange={(e) => onPickColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black/10 cursor-pointer p-0"
                    title="Custom colour"
                  />
                  <span className="text-[11px] text-black/45">Custom hex</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Swatch({
  label,
  color,
  selected,
  onClick,
  isAuto,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onClick: () => void;
  isAuto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`w-7 h-7 rounded border transition ${
        selected ? "ring-2 ring-[#1b3a2d] ring-offset-1" : "border-black/10 hover:border-black/30"
      } ${isAuto ? "text-[8px] font-bold text-black/50 flex items-center justify-center" : ""}`}
      style={
        isAuto
          ? { background: "linear-gradient(135deg, #f5e8d8 0%, #f5e8d8 50%, #1a1a1a 50%, #1a1a1a 100%)" }
          : { background: color }
      }
    >
      {isAuto ? "A" : null}
    </button>
  );
}

// HTML <input type="color"> only accepts #rrggbb. Strip alpha and rgba()
// down to a hex so the picker is initialised to the closest match.
function hexFromColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const t = color.trim();
  if (t.startsWith("#")) return t.length === 7 ? t : undefined;
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(t);
  if (!m) return undefined;
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(parseInt(m[1], 10))}${toHex(parseInt(m[2], 10))}${toHex(parseInt(m[3], 10))}`;
}
