"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";

// ─── InlineTextToolbar ───────────────────────────────────────────────────
//
// Robust black-themed floating formatting editor. Appears whenever the
// operator selects text inside any contentEditable element on the
// proposal AND editor mode is on. Coexists with AISelectionToolbar
// (rewrites/shorten/lengthen/tone) — this one stacks ABOVE the AI
// toolbar so both can show without overlap on long-form selections.
//
// Controls (compact horizontal pill):
//
//   B  I  U  S    |  Aa Font ▾    |  ⓢ Size   |  ● Color  |  ▢ Highlight  |  ⌫ Clear
//
// All formatting applies via Range manipulation, wrapping the selected
// nodes in a fresh <span style="…"> (with extractContents fallback).
// Toggle commands (B / I / U / S) check the surrounding context for
// existing inline tags and patch them in-place; non-toggle commands
// always wrap.
//
// Save path: the section's contentEditable owns the saved HTML. When
// converted to RichEditable, the onBlur fires sanitizeRichText and
// persists. For sections still on the plain-text textContent path, the
// inline formatting is visible in editor only and gets stripped on
// blur — ConvertCallback queue is the long-form fix.
//
// Visual taste: Shadcn dark — solid black surface, subtle border,
// icon-button hover states, Framer-motion fade+slide entry. Single
// pill, no chunky chrome.

const PRESET_COLORS: { value: string; label: string }[] = [
  { value: "#ffffff", label: "White" },
  { value: "#101828", label: "Charcoal" },
  { value: "#1f3a3a", label: "Teal" },
  { value: "#2d5a40", label: "Sage" },
  { value: "#c9a84c", label: "Gold" },
  { value: "#b06a3b", label: "Copper" },
  { value: "#b34334", label: "Brick" },
  { value: "#8a4ca8", label: "Plum" },
  { value: "#3a6ea5", label: "Indigo" },
];

const PRESET_HIGHLIGHTS: { value: string; label: string }[] = [
  { value: "transparent", label: "None" },
  { value: "rgba(255, 240, 100, 0.55)", label: "Yellow" },
  { value: "rgba(120, 200, 255, 0.45)", label: "Blue" },
  { value: "rgba(120, 230, 160, 0.45)", label: "Green" },
  { value: "rgba(255, 170, 200, 0.45)", label: "Pink" },
  { value: "rgba(245, 232, 216, 0.85)", label: "Cream" },
  { value: "rgba(0, 0, 0, 0.85)", label: "Black" },
];

// Broad font roster grouped by character — serifs / sans / display /
// handwriting / mono. The proposal's two theme fonts (display + body)
// are surfaced FIRST in the menu (see themeFonts below) so operators
// don't have to scan to find them.
const FONT_FAMILY_OPTIONS = [
  { value: "", label: "Default" },
  // ── Serif (editorial / book) ──────────────────────────────────────
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Cormorant Garamond', serif", label: "Cormorant" },
  { value: "'EB Garamond', serif", label: "EB Garamond" },
  { value: "'Lora', serif", label: "Lora" },
  { value: "'Merriweather', serif", label: "Merriweather" },
  { value: "'Crimson Pro', serif", label: "Crimson Pro" },
  { value: "'Source Serif Pro', serif", label: "Source Serif" },
  // ── Sans (modern / corporate) ─────────────────────────────────────
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Raleway', sans-serif", label: "Raleway" },
  { value: "'Work Sans', sans-serif", label: "Work Sans" },
  { value: "'IBM Plex Sans', sans-serif", label: "IBM Plex Sans" },
  // ── Display (loud / poster) ───────────────────────────────────────
  { value: "'Bebas Neue', sans-serif", label: "Bebas Neue" },
  { value: "'Oswald', sans-serif", label: "Oswald" },
  // ── Handwriting / script ──────────────────────────────────────────
  { value: "'Caveat', cursive", label: "Caveat" },
  { value: "'Pacifico', cursive", label: "Pacifico" },
  { value: "'Italianno', cursive", label: "Italianno" },
  // ── Mono ──────────────────────────────────────────────────────────
  { value: "monospace", label: "Mono" },
] as const;

export function InlineTextToolbar() {
  const mode = useEditorStore((s) => s.mode);
  const { proposal } = useProposalStore();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const [sizeInput, setSizeInput] = useState<string>("");
  const [openMenu, setOpenMenu] = useState<
    null | "color" | "highlight" | "font"
  >(null);

  // Theme fonts surfaced as the first two custom-named entries in the
  // font menu so operators can pick "the proposal's heading font" by
  // name without knowing the family string.
  const themeFonts = [
    { value: `'${proposal.theme.displayFont}', serif`, label: `${proposal.theme.displayFont} (display)` },
    { value: `'${proposal.theme.bodyFont}', sans-serif`, label: `${proposal.theme.bodyFont} (body)` },
  ];

  useEffect(() => {
    if (mode !== "editor") return;
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPos(null);
        rangeRef.current = null;
        hostRef.current = null;
        setOpenMenu(null);
        return;
      }
      const range = sel.getRangeAt(0);
      // Climb to the nearest contentEditable host.
      let node: Node | null = range.commonAncestorContainer;
      let host: HTMLElement | null = null;
      while (node && node !== document.body) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.isContentEditable) {
            host = el;
            break;
          }
        }
        node = node.parentNode;
      }
      if (!host) {
        setPos(null);
        return;
      }
      // We deliberately do NOT skip when an ancestor has
      // [data-editor-chrome] — SectionChrome wraps every section
      // with that attribute, so the old check made the toolbar
      // invisible everywhere. Selection inside the portal'd toolbar
      // never reaches this point because none of the toolbar's
      // descendants are contentEditable (the size input is a real
      // <input>, not contenteditable), so `host` ends up null and
      // we return earlier. No additional guard needed.
      const rect = range.getBoundingClientRect();
      // Smart position: prefer ABOVE the selection (88px above so we
      // stack above the AI toolbar at -44px). If there's not enough
      // viewport space above, flip BELOW the selection. Horizontal:
      // centre over the selection, clamped to viewport edges so the
      // toolbar never runs off-screen.
      const W = 520;
      const TOOLBAR_H = 52;
      const margin = 12;
      let left = rect.left + rect.width / 2 - W / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (left < margin) left = margin;
      if (left + W > vw - margin) left = vw - W - margin;
      let top = rect.top - 88;
      // Not enough room above? Flip below the selection.
      if (top < margin) top = rect.bottom + 12;
      // Last-resort: clamp to viewport bottom so we don't disappear
      // entirely on a selection at the very bottom of the page.
      if (top + TOOLBAR_H > vh - margin) {
        top = Math.max(margin, vh - TOOLBAR_H - margin);
      }
      setPos({ top, left });
      rangeRef.current = range.cloneRange();
      hostRef.current = host;
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [mode]);

  // ── Apply helpers ──

  const restoreRange = (): { range: Range; sel: Selection } | null => {
    const range = rangeRef.current;
    const sel = window.getSelection();
    if (!range || !sel) return null;
    sel.removeAllRanges();
    sel.addRange(range);
    return { range, sel };
  };

  const reselectSpan = (span: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
    rangeRef.current = r.cloneRange();
  };

  const wrapInSpan = (
    style: Partial<CSSStyleDeclaration>,
  ): HTMLElement | null => {
    const ctx = restoreRange();
    if (!ctx) return null;
    const { range } = ctx;
    const span = document.createElement("span");
    Object.assign(span.style, style);
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    reselectSpan(span);
    hostRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    return span;
  };

  // Toggle a tag (b / i / u / s). If the entire selection is already
  // inside the tag, unwrap it; otherwise wrap.
  const toggleTag = (tag: "b" | "i" | "u" | "s") => {
    const ctx = restoreRange();
    if (!ctx) return;
    const { range, sel } = ctx;
    const ancestor = range.commonAncestorContainer.parentElement;
    const inside = ancestor?.closest(tag);
    if (inside && range.toString() === inside.textContent) {
      // Unwrap — replace tag with its children.
      const parent = inside.parentNode;
      if (parent) {
        while (inside.firstChild) parent.insertBefore(inside.firstChild, inside);
        parent.removeChild(inside);
      }
      hostRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
      // Restore selection roughly — collapse to the original range
      // start. Re-wrapping isn't needed; React will rerender on save.
      sel.removeAllRanges();
      return;
    }
    const el = document.createElement(tag);
    try {
      range.surroundContents(el);
    } catch {
      const frag = range.extractContents();
      el.appendChild(frag);
      range.insertNode(el);
    }
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(el);
    sel.addRange(r);
    rangeRef.current = r.cloneRange();
    hostRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const setColor = (color: string) => {
    wrapInSpan({ color });
    setOpenMenu(null);
  };

  const setHighlight = (bg: string) => {
    wrapInSpan({ backgroundColor: bg === "transparent" ? "" : bg });
    setOpenMenu(null);
  };

  const setFontFamily = (family: string) => {
    wrapInSpan({ fontFamily: family });
    setOpenMenu(null);
  };

  const applySize = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isFinite(n) || n < 6 || n > 200) return;
    wrapInSpan({ fontSize: `${n}px` });
  };

  // Strip every inline span/tag wrapping the selection — restores to
  // plain text. Useful when an operator wants to undo formatting
  // without ctrl-z (which only undoes the last action).
  const clearFormatting = () => {
    const ctx = restoreRange();
    if (!ctx) return;
    const { range } = ctx;
    const text = range.toString();
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    hostRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  };

  if (mode !== "editor" || !pos || typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {pos && (
        <motion.div
          key="ss-text-toolbar"
          data-editor-chrome
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", damping: 22, stiffness: 360 }}
          className="fixed z-[10000]"
          style={{ top: pos.top, left: pos.left, width: 520 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div
            className="rounded-xl shadow-2xl flex items-center gap-0.5 px-1.5 py-1.5"
            style={{
              background: "#0a0a0a",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 12px 30px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.25)",
            }}
          >
            {/* Bold / Italic / Underline / Strikethrough */}
            <ToolbarBtn title="Bold" onClick={() => toggleTag("b")}>
              <BoldIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Italic" onClick={() => toggleTag("i")}>
              <ItalicIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Underline" onClick={() => toggleTag("u")}>
              <UnderlineIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Strikethrough" onClick={() => toggleTag("s")}>
              <StrikeIcon />
            </ToolbarBtn>

            <Divider />

            {/* Font family */}
            <PopoverBtn
              title="Font"
              open={openMenu === "font"}
              onToggle={() => setOpenMenu(openMenu === "font" ? null : "font")}
            >
              <span className="text-[12px] font-medium tracking-tight">Aa</span>
              <Caret />
            </PopoverBtn>

            {/* Size — numeric input in pixels */}
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                Size
              </span>
              <input
                type="number"
                min={6}
                max={200}
                placeholder="--"
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applySize(sizeInput);
                  }
                }}
                onBlur={() => {
                  if (sizeInput) applySize(sizeInput);
                }}
                className="w-12 bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5 text-[12px] text-white text-center outline-none focus:border-white/30 transition-colors"
              />
              <span className="text-[10px] text-white/35">px</span>
            </div>

            <Divider />

            {/* Text color */}
            <PopoverBtn
              title="Text colour"
              open={openMenu === "color"}
              onToggle={() => setOpenMenu(openMenu === "color" ? null : "color")}
            >
              <ColorChipIcon />
              <Caret />
            </PopoverBtn>

            {/* Background highlight */}
            <PopoverBtn
              title="Highlight"
              open={openMenu === "highlight"}
              onToggle={() =>
                setOpenMenu(openMenu === "highlight" ? null : "highlight")
              }
            >
              <HighlightIcon />
              <Caret />
            </PopoverBtn>

            <Divider />

            {/* Clear formatting */}
            <ToolbarBtn title="Clear formatting" onClick={clearFormatting}>
              <ClearIcon />
            </ToolbarBtn>
          </div>

          {/* ── Popovers — anchored under the toolbar ────────────── */}
          <AnimatePresence>
            {openMenu === "font" && (
              <PopoverPanel key="font-panel" align="left">
                {[...themeFonts, ...FONT_FAMILY_OPTIONS].map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => setFontFamily(f.value)}
                    className="w-full text-left px-2.5 py-1.5 text-[12.5px] rounded-md hover:bg-white/10 transition-colors flex items-center gap-2"
                    style={{ fontFamily: f.value || "inherit" }}
                  >
                    <span className="flex-1 text-white/85">{f.label}</span>
                    <span className="text-white/35 text-[11px]">Aa</span>
                  </button>
                ))}
              </PopoverPanel>
            )}

            {openMenu === "color" && (
              <PopoverPanel key="color-panel" align="center">
                <div className="text-[10px] uppercase tracking-wider text-white/40 px-1.5 mb-1.5">
                  Text colour
                </div>
                <div className="grid grid-cols-9 gap-1 px-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setColor(c.value)}
                      className="w-6 h-6 rounded-md border border-white/10 hover:scale-110 transition-transform"
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 px-1">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">
                    Hex
                  </span>
                  <input
                    type="text"
                    placeholder="#000000"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = (e.currentTarget.value || "").trim();
                        if (/^#[0-9a-f]{3,8}$/i.test(v)) setColor(v);
                      }
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5 text-[11.5px] text-white outline-none focus:border-white/30 font-mono"
                  />
                </div>
              </PopoverPanel>
            )}

            {openMenu === "highlight" && (
              <PopoverPanel key="highlight-panel" align="center">
                <div className="text-[10px] uppercase tracking-wider text-white/40 px-1.5 mb-1.5">
                  Highlight
                </div>
                <div className="grid grid-cols-7 gap-1 px-1">
                  {PRESET_HIGHLIGHTS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setHighlight(c.value)}
                      className="w-7 h-7 rounded-md border border-white/10 hover:scale-110 transition-transform flex items-center justify-center"
                      style={{
                        background:
                          c.value === "transparent"
                            ? "repeating-conic-gradient(rgba(255,255,255,0.12) 0% 25%, transparent 0% 50%) 50% / 8px 8px"
                            : c.value,
                      }}
                    >
                      {c.value === "transparent" && (
                        <span className="text-[8px] text-white/50">—</span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function ToolbarBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-white/15 text-white"
          : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function PopoverBtn({
  children,
  onToggle,
  open,
  title,
}: {
  children: React.ReactNode;
  onToggle: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onToggle}
      className={`h-7 px-2 flex items-center gap-1 rounded-md transition-colors ${
        open
          ? "bg-white/15 text-white"
          : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-white/10 mx-0.5" aria-hidden />;
}

function Caret() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
      <path d="M2 3 L4 5.5 L6 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PopoverPanel({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const alignmentStyle =
    align === "center"
      ? { left: "50%", transform: "translateX(-50%)" }
      : align === "right"
      ? { right: 0 }
      : { left: 0 };
  return (
    <motion.div
      data-editor-chrome
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ type: "spring", damping: 22, stiffness: 380 }}
      className="absolute mt-1.5 rounded-xl py-2 px-1.5 min-w-[200px] overflow-y-auto"
      style={{
        ...alignmentStyle,
        top: "100%",
        // Cap the popover height to a reasonable fraction of the
        // viewport so a long font list scrolls instead of running
        // off-screen. Smart-position direction (above/below toolbar)
        // is handled by the toolbar itself flipping its baseline if
        // there's no room above the selection — see the `top` calc
        // in the selectionchange handler.
        maxHeight: "min(420px, 60vh)",
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "0 12px 30px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Icons (inline SVG to avoid lucide dep) ──────────────────────────────

function BoldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 2.5h4a2.5 2.5 0 0 1 0 5h-4z" />
      <path d="M3.5 7.5h4.5a2.5 2.5 0 0 1 0 5H3.5z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <line x1="6" y1="2" x2="11" y2="2" />
      <line x1="3" y1="12" x2="8" y2="12" />
      <line x1="9" y1="2" x2="5" y2="12" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M3.5 2v5a3.5 3.5 0 0 0 7 0V2" />
      <line x1="2.5" y1="12" x2="11.5" y2="12" />
    </svg>
  );
}

function StrikeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 7h9" />
      <path d="M9.5 4a3 3 0 0 0-5-1.5" />
      <path d="M4.5 10a3 3 0 0 0 5 1.5" />
    </svg>
  );
}

function ColorChipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 11.5h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3.5 9.5L7 2l3.5 7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 2.5l3 3-5 5-3 .5.5-3z" />
      <path d="M3 12.5h8" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11l3-3" />
      <path d="M5 5l4-2 3 3-2 4-3 1z" />
      <path d="M2 12.5h7" />
    </svg>
  );
}
