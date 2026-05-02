"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { IntelligentColorPicker } from "./IntelligentColorPicker";

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
//   B  I  U  S  |  L C R J  |  Aa Font ▾  |  Size  |  ● Color  |  ▢ Hi  |  ⌫  ✕
//
// Range manipulation strategy:
//   • Toggle tags (B / I / U / S) — wrap or unwrap the selection.
//   • Style tags (color / highlight / font / size) — when the
//     selection is the entire contents of a same-host span, PATCH
//     that span's style. Otherwise wrap a fresh <span data-ss-fmt="1"
//     style="…">. This is what fixes the historical "color only
//     changes once / size compounds" bugs: repeated applies update
//     one span instead of nesting wrappers.
//   • Alignment (L C R J) — uses document.execCommand("justify…")
//     because text-align only takes effect on a block ancestor.
//
// Popover discipline:
//   • Open on click, stay open until the operator clicks the X,
//     clicks outside the toolbar, or presses Escape. Style picks
//     do NOT auto-close — operators sample colours / fonts / sizes
//     and watch the live result.
//   • Mutual exclusion with FloatingColorPicker: opening either
//     dispatches/listens-for `ss:close-text-popovers`.
//   • Two lanes: this toolbar lives on the LEFT half of the
//     viewport; FloatingColorPicker pins to the RIGHT edge.
//   • Direction (up / down) recomputes on scroll/resize so a long
//     font menu never falls off the bottom.
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
  const closeFloatingPicker = useEditorStore((s) => s.closeFloatingPicker);
  const { proposal } = useProposalStore();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Direction the popover panels open: "down" anchors them under the
  // toolbar (default — toolbar at top of viewport); "up" flips them
  // above the toolbar when the toolbar is in the lower half of the
  // viewport so the panel doesn't run off-screen.
  const [popoverDir, setPopoverDir] = useState<"up" | "down">("down");
  const rangeRef = useRef<Range | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [sizeInput, setSizeInput] = useState<string>("");
  // Live-preview debounce timer for the size input. Operator brief:
  // "size applies only once then disappears, not time to play around
  // and adjust the sizes and see in real time the changes long enough
  // to make decisions." Every keystroke schedules a 220ms apply so
  // typing 18 → 20 → 22 each shows live; we no longer dedupe, so
  // operators can re-apply the same size to recover from a stray
  // click that lost the wrap.
  const sizeApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openMenu, setOpenMenu] = useState<
    null | "color" | "highlight" | "font" | "align"
  >(null);
  // Mirror of openMenu in a ref so the document-level selectionchange
  // listener (registered once on mount) can read the latest value
  // without being torn down on every state change.
  const openMenuRef = useRef<typeof openMenu>(null);
  useEffect(() => {
    openMenuRef.current = openMenu;
  }, [openMenu]);

  // ── Mutual exclusion with the FloatingColorPicker ──────────────────
  // Two simultaneous colour editors stacking on top of each other was
  // the operator's #1 complaint. Whenever either one opens, it tells
  // the other to close. The text toolbar lives in the LEFT lane (it
  // floats over the selection); FloatingColorPicker pins itself to
  // the RIGHT edge of the viewport. Single-source-of-truth rule.
  useEffect(() => {
    const onClose = () => setOpenMenu(null);
    document.addEventListener("ss:close-text-popovers", onClose);
    return () => document.removeEventListener("ss:close-text-popovers", onClose);
  }, []);
  useEffect(() => {
    if (openMenu) closeFloatingPicker();
  }, [openMenu, closeFloatingPicker]);

  // Click-outside closes the OPEN popover (color / highlight / font),
  // but the toolbar itself stays put — only X dismisses the toolbar.
  // Escape also collapses the popover.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && toolbarRef.current?.contains(t)) return;
      setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // Theme fonts surfaced as the first two custom-named entries in the
  // font menu so operators can pick "the proposal's heading font" by
  // name without knowing the family string.
  const themeFonts = [
    { value: `'${proposal.theme.displayFont}', serif`, label: `${proposal.theme.displayFont} (display)` },
    { value: `'${proposal.theme.bodyFont}', sans-serif`, label: `${proposal.theme.bodyFont} (body)` },
  ];

  // Persistent visibility model — the toolbar appears on the first
  // text highlight in editor mode and STAYS visible until the
  // operator clicks the X. Subsequent selection changes update the
  // saved Range so format clicks always target the latest selection,
  // but they don't tear the toolbar down. Operator brief: "appears
  // on highlighting text and only goes on X."
  useEffect(() => {
    if (mode !== "editor") return;
    const onSelectionChange = () => {
      // If focus is currently inside the toolbar (size input, etc.),
      // selectionchange events fire as a side-effect of the input
      // taking focus. Don't tear down the saved Range or reposition
      // the toolbar in that case — the operator is mid-interaction.
      const active = document.activeElement as HTMLElement | null;
      if (active && toolbarRef.current?.contains(active)) return;
      // If a popover is open, the operator is sampling colours / fonts /
      // sizes — every apply re-selects the wrapped span, which fires
      // selectionchange. Repositioning the toolbar on each tick would
      // make the popover dance under the cursor. Lock the position
      // until the popover closes.
      if (openMenuRef.current) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        // Selection lost (clicked elsewhere, keyboard nav, etc.).
        // We deliberately do NOT clear pos / rangeRef here — the
        // toolbar must stay open until X. Format clicks continue to
        // target the previously-saved range.
        return;
      }
      const range = sel.getRangeAt(0);
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
        // New selection isn't inside any contentEditable. Keep the
        // toolbar where it was; the saved range still applies.
        return;
      }

      // Real text highlight inside an editable region — save the
      // range, host, and (re)position the toolbar. The toolbar lives
      // in the LEFT lane: clamped to the left half of the viewport
      // so it never collides with the FloatingColorPicker on the
      // right.
      const rect = range.getBoundingClientRect();
      const W = 560;
      const TOOLBAR_H = 52;
      const margin = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.left + rect.width / 2 - W / 2;
      // Hard left-lane clamp: never extend past 56% of the viewport
      // so the right lane stays free for FloatingColorPicker.
      const leftLaneMax = Math.max(margin, vw * 0.56 - W);
      if (left < margin) left = margin;
      if (left > leftLaneMax) left = leftLaneMax;
      let top = rect.top - TOOLBAR_H - 16;
      if (top < margin) top = rect.bottom + 12;
      if (top + TOOLBAR_H > vh - margin) top = Math.max(margin, vh - TOOLBAR_H - margin);

      // Position hysteresis. Operator brief: "the text editor flips
      // a lot, does not stay long enough for one to see the changes."
      // Tiny selection-rect drifts (cursor blink, browser sub-pixel
      // jitter, contentEditable autoplay) used to nudge the toolbar
      // a few pixels each frame and visually felt like a constant
      // dance. Hold position when the new spot is within 80px of the
      // current one; only re-anchor on bigger jumps (operator selects
      // a different paragraph, scrolls the canvas a long way, etc.).
      // Popover direction is recomputed only on those big jumps so
      // the panel doesn't flip up↔down mid-edit.
      setPos((prev) => {
        if (!prev) {
          const toolbarBottom = top + TOOLBAR_H;
          setPopoverDir(toolbarBottom > vh * 0.6 ? "up" : "down");
          return { top, left };
        }
        const dx = Math.abs(prev.left - left);
        const dy = Math.abs(prev.top - top);
        if (dx < 80 && dy < 80) return prev;
        const toolbarBottom = top + TOOLBAR_H;
        setPopoverDir(toolbarBottom > vh * 0.6 ? "up" : "down");
        return { top, left };
      });
      rangeRef.current = range.cloneRange();
      hostRef.current = host;
    };
    document.addEventListener("selectionchange", onSelectionChange);
    // Reposition on scroll / resize so the toolbar tracks the
    // selection as the canvas moves and the popover direction stays
    // correct.
    const onViewport = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      onSelectionChange();
    };
    window.addEventListener("scroll", onViewport, true);
    window.addEventListener("resize", onViewport);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", onViewport, true);
      window.removeEventListener("resize", onViewport);
    };
  }, [mode]);

  // Explicit close — only path that hides the toolbar. Resets
  // saved range so a fresh selection re-shows it.
  const closeToolbar = () => {
    setPos(null);
    setOpenMenu(null);
    rangeRef.current = null;
    hostRef.current = null;
    setSizeInput("");
  };

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

  // Find a same-host span the selection sits ENTIRELY inside, so we
  // can patch its style instead of nesting another wrapper. Returns
  // null when the selection straddles multiple parents — those need
  // a fresh wrap. This is what fixes the "size compounds / colour
  // only changes once" bugs: repeat applies update one span instead
  // of stacking wrappers that React + sanitiseRichText eventually
  // collapse unpredictably.
  const findEnclosingSpan = (range: Range): HTMLElement | null => {
    const start = range.startContainer;
    const end = range.endContainer;
    const startSpan = closestSpan(start);
    const endSpan = closestSpan(end);
    if (!startSpan || startSpan !== endSpan) return null;
    // Selection must equal the span's full text content for a clean
    // patch. Anything narrower wraps fresh so we don't re-style
    // text outside the user's highlight.
    if (range.toString() !== (startSpan.textContent ?? "")) return null;
    return startSpan;
  };

  const wrapInSpan = (
    style: Partial<CSSStyleDeclaration>,
  ): HTMLElement | null => {
    const ctx = restoreRange();
    if (!ctx) return null;
    const { range } = ctx;
    // Patch path — selection is already inside one span and covers
    // its entire text. Just update its style; no new DOM nodes.
    const existing = findEnclosingSpan(range);
    if (existing) {
      Object.assign(existing.style, style);
      reselectSpan(existing);
      hostRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
      return existing;
    }
    // Fresh wrap path — make a new span. Mark it with data-ss-fmt
    // so post-render re-binds can resolve it back from a stale
    // range if React replaces the DOM (e.g. RichEditable resets
    // innerHTML on save).
    const span = document.createElement("span");
    span.setAttribute("data-ss-fmt", "1");
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

  // Style appliers do NOT close the popover. The operator's brief:
  // "having the colour stay long enough without disappearing so we
  // can be able to change and be able and see the changes". The
  // popover stays open until X / outside-click; meanwhile the
  // operator can sample as many colours / fonts / sizes as they
  // want and watch the live result.
  const setColor = (color: string) => {
    wrapInSpan({ color });
  };

  const setHighlight = (bg: string) => {
    wrapInSpan({ backgroundColor: bg === "transparent" ? "" : bg });
  };

  const setFontFamily = (family: string) => {
    wrapInSpan({ fontFamily: family });
  };

  const applySize = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isFinite(n) || n < 6 || n > 200) return;
    wrapInSpan({ fontSize: `${n}px` });
  };

  // Debounced live-preview for the size input. Operator brief: "size
  // applies only once then disappears, not time to play around and
  // adjust the sizes and see in real time the changes long enough to
  // make decisions." 220ms is short enough to feel responsive while
  // typing two-digit numbers (18, 20, 22) and long enough that a
  // brief pause commits cleanly. The patch path inside wrapInSpan is
  // idempotent — re-applying the same size on the same span just
  // overwrites font-size on that one span, no nesting.
  const scheduleSizeApply = (raw: string) => {
    if (sizeApplyTimerRef.current) clearTimeout(sizeApplyTimerRef.current);
    if (!raw.trim()) return;
    sizeApplyTimerRef.current = setTimeout(() => {
      applySize(raw);
    }, 220);
  };
  // Flush any pending debounce on unmount so a half-typed size doesn't
  // apply long after the toolbar dismounts.
  useEffect(() => {
    return () => {
      if (sizeApplyTimerRef.current) clearTimeout(sizeApplyTimerRef.current);
    };
  }, []);

  // ── Alignment ──────────────────────────────────────────────────────
  // text-align is a BLOCK-level property; applied to a span it does
  // nothing. Browsers' built-in justifyLeft/Center/Right/Full
  // commands traverse the selection and set text-align on the
  // closest block ancestor for us — exactly the right behaviour for
  // a contentEditable. execCommand is deprecated on paper but every
  // current browser still ships these alignment commands (Notion,
  // Google Docs, Slack all rely on them). No removal date in sight.
  const setAlign = (align: "left" | "center" | "right" | "justify") => {
    const ctx = restoreRange();
    if (!ctx) return;
    const cmd =
      align === "left"
        ? "justifyLeft"
        : align === "center"
          ? "justifyCenter"
          : align === "right"
            ? "justifyRight"
            : "justifyFull";
    document.execCommand(cmd);
    hostRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
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
          ref={toolbarRef}
          data-editor-chrome
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", damping: 22, stiffness: 360 }}
          className="fixed z-[10000]"
          style={{ top: pos.top, left: pos.left, width: 560 }}
          // NOTE: no onMouseDown=preventDefault on the wrapper. We
          // need clicks on the size / hex inputs to focus them
          // normally so the operator can type. Buttons that should
          // preserve the contentEditable selection (B / I / U / S /
          // popover triggers / clear / X) call preventDefault
          // themselves via the shared button components.
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

            {/* Alignment — applies text-align to the closest block
                ancestor of the selection (paragraph / heading / list
                item). On a span it would do nothing. */}
            <ToolbarBtn title="Align left" onClick={() => setAlign("left")}>
              <AlignLeftIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Align centre" onClick={() => setAlign("center")}>
              <AlignCenterIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Align right" onClick={() => setAlign("right")}>
              <AlignRightIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Justify" onClick={() => setAlign("justify")}>
              <AlignJustifyIcon />
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

            {/* Size — numeric input in pixels. The wrapper does NOT
                preventDefault on mousedown so clicking the input
                focuses it normally and the operator can type digits. */}
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
                onFocus={() => {
                  // Restore the saved range so the operator's
                  // selection survives a click into the size input
                  // (otherwise re-clicking the input after typing
                  // would lose the wrap target and the next change
                  // would create a stray span elsewhere).
                  restoreRange();
                }}
                onChange={(e) => {
                  const v = e.target.value;
                  setSizeInput(v);
                  scheduleSizeApply(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (sizeApplyTimerRef.current) {
                      clearTimeout(sizeApplyTimerRef.current);
                    }
                    applySize(sizeInput);
                  }
                  // Up / down arrow keys nudge the size by ±1 with
                  // immediate live-preview — operators can land on
                  // the right size by tap-tap-tapping rather than
                  // re-typing. Bypasses the debounce because the
                  // value is intentional, not a typo in flight.
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const cur = parseInt(sizeInput, 10);
                    const base = isFinite(cur) ? cur : 14;
                    const next = Math.max(
                      6,
                      Math.min(200, base + (e.key === "ArrowUp" ? 1 : -1)),
                    );
                    const v = String(next);
                    setSizeInput(v);
                    if (sizeApplyTimerRef.current) {
                      clearTimeout(sizeApplyTimerRef.current);
                    }
                    applySize(v);
                  }
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

            {/* Close — the ONLY way to dismiss the toolbar. Operator
                brief: "appears on highlighting text and only goes
                on X." */}
            <Divider />
            <ToolbarBtn title="Close" onClick={closeToolbar}>
              <CloseIcon />
            </ToolbarBtn>
          </div>

          {/* ── Popovers — anchored under the toolbar ────────────── */}
          <AnimatePresence>
            {openMenu === "font" && (
              <PopoverPanel key="font-panel" align="left" direction={popoverDir}>
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
              <PopoverPanel key="color-panel" align="center" direction={popoverDir}>
                <div className="text-[10px] uppercase tracking-wider text-white/40 px-0.5 mb-1.5">
                  Text colour
                </div>
                <IntelligentColorPicker
                  value={undefined}
                  onChange={(hex) => setColor(hex)}
                  brandColors={proposal.operator?.brandColors}
                  presets={PRESET_COLORS}
                />
              </PopoverPanel>
            )}

            {openMenu === "highlight" && (
              <PopoverPanel key="highlight-panel" align="center" direction={popoverDir}>
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
      // preventDefault on mousedown so clicking the button doesn't
      // shift focus away from the contentEditable; the saved Range
      // stays valid for the format apply.
      onMouseDown={(e) => e.preventDefault()}
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
      onMouseDown={(e) => e.preventDefault()}
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
  direction = "down",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  /** Open downwards (default) or upwards relative to the toolbar.
   *  Driven by `popoverDir` in the parent — flips up when the
   *  toolbar is in the lower half of the viewport so the panel
   *  doesn't run off-screen. */
  direction?: "up" | "down";
}) {
  const alignmentStyle =
    align === "center"
      ? { left: "50%", transform: "translateX(-50%)" }
      : align === "right"
      ? { right: 0 }
      : { left: 0 };
  const directionStyle =
    direction === "up"
      ? { bottom: "100%", marginBottom: 6 }
      : { top: "100%", marginTop: 6 };
  return (
    <motion.div
      data-editor-chrome
      initial={{ opacity: 0, y: direction === "up" ? -6 : 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: direction === "up" ? -6 : 6, scale: 0.97 }}
      transition={{ type: "spring", damping: 22, stiffness: 380 }}
      className="absolute rounded-xl py-2 px-1.5 min-w-[200px] overflow-y-auto"
      style={{
        ...alignmentStyle,
        ...directionStyle,
        // Cap the popover height to a fraction of the viewport so a
        // long font list scrolls instead of running off-screen.
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

function AlignLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <line x1="2" y1="3" x2="12" y2="3" />
      <line x1="2" y1="6" x2="9" y2="6" />
      <line x1="2" y1="9" x2="12" y2="9" />
      <line x1="2" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <line x1="2" y1="3" x2="12" y2="3" />
      <line x1="4" y1="6" x2="10" y2="6" />
      <line x1="2" y1="9" x2="12" y2="9" />
      <line x1="4" y1="12" x2="10" y2="12" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <line x1="2" y1="3" x2="12" y2="3" />
      <line x1="5" y1="6" x2="12" y2="6" />
      <line x1="2" y1="9" x2="12" y2="9" />
      <line x1="5" y1="12" x2="12" y2="12" />
    </svg>
  );
}

function AlignJustifyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <line x1="2" y1="3" x2="12" y2="3" />
      <line x1="2" y1="6" x2="12" y2="6" />
      <line x1="2" y1="9" x2="12" y2="9" />
      <line x1="2" y1="12" x2="12" y2="12" />
    </svg>
  );
}

// closestSpan walks up from a Text/Element node to the nearest
// ancestor that is a <span> inside a contentEditable. Used by
// findEnclosingSpan to detect the patch-vs-wrap path.
function closestSpan(node: Node | null): HTMLElement | null {
  let n: Node | null = node;
  while (n && n.nodeType !== Node.ELEMENT_NODE) n = n.parentNode;
  let el = n as HTMLElement | null;
  while (el) {
    if (el.tagName === "SPAN" && el.isContentEditable !== false) return el;
    if (el.getAttribute?.("contenteditable") === "true") return null;
    el = el.parentElement;
  }
  return null;
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3 L11 11" />
      <path d="M11 3 L3 11" />
    </svg>
  );
}
