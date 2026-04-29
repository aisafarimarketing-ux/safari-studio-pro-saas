"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorStore } from "@/store/editorStore";

// ─── InlineTextToolbar ───────────────────────────────────────────────────
//
// Floating mini-toolbar that appears whenever the operator selects text
// inside any contentEditable element on the proposal AND editor mode
// is on. Two affordances:
//
//   • Colour picker  — preset swatches (charcoal / teal / sage / gold
//     / copper / brick / cream / white)
//   • Font-size input — type a number (10 / 14 / 20…), apply on Enter
//     or blur, in pixels
//
// Apply path: wrap the current Range in a fresh <span style="…"> via
// surroundContents() (with extractContents+insert fallback for ranges
// that cross node boundaries). The contentEditable element is the
// source of truth — its onBlur handler must save innerHTML, not
// textContent, for the styling to round-trip.
//
// Why Range manipulation, not document.execCommand: execCommand
// foreColor / fontSize are deprecated, the fontSize variant is
// 1-7 scale (not pixels), and they emit non-deterministic markup
// across browsers. Range + inline-styled span is auditable and
// compatible with our sanitiser.
//
// Mounted once at the editor chrome root (ProposalEditor.tsx) so a
// single instance handles every contentEditable in the document.

const PRESET_COLORS: { value: string; label: string }[] = [
  { value: "#101828", label: "Charcoal" },
  { value: "#1f3a3a", label: "Teal" },
  { value: "#2d5a40", label: "Sage" },
  { value: "#c9a84c", label: "Gold" },
  { value: "#b06a3b", label: "Copper" },
  { value: "#b34334", label: "Brick" },
  { value: "#f5e8d8", label: "Cream" },
  { value: "#ffffff", label: "White" },
];

export function InlineTextToolbar() {
  const mode = useEditorStore((s) => s.mode);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Track the most recent Range so apply-clicks can re-target it
  // after focus moves to a toolbar control (which clears the
  // window selection).
  const rangeRef = useRef<Range | null>(null);
  // contentEditable host of the current selection — used so we can
  // dispatch a synthetic input/blur to trigger the section's save
  // path after applying a style change.
  const hostRef = useRef<HTMLElement | null>(null);
  const [sizeInput, setSizeInput] = useState<string>("");

  useEffect(() => {
    // Only subscribe in editor mode. When the operator switches to
    // preview, the cleanup unsubscribes; we don't reset `pos` here
    // (that would be a setState-in-effect rule violation), but the
    // render guard below hides the toolbar regardless of pos.
    if (mode !== "editor") return;
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPos(null);
        rangeRef.current = null;
        hostRef.current = null;
        return;
      }
      const range = sel.getRangeAt(0);
      // Walk up to find the nearest contentEditable host. Only show
      // the toolbar when the selection is actually inside an editable
      // region — avoids false-positives from random page text.
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
        rangeRef.current = null;
        hostRef.current = null;
        return;
      }
      // Skip when the selection is inside editor chrome itself —
      // e.g. selecting text in this very toolbar shouldn't re-trigger
      // the toolbar.
      if (host.closest("[data-editor-chrome]")) {
        setPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      // Toolbar is ~280px wide; centre it horizontally over the
      // selection, clamped to the viewport with a 12px margin so it
      // never clips the screen edges. If there isn't room above the
      // selection, drop it below.
      const W = 280;
      let left = rect.left + rect.width / 2 - W / 2;
      const margin = 12;
      const vw = window.innerWidth;
      if (left < margin) left = margin;
      if (left + W > vw - margin) left = vw - W - margin;
      let top = rect.top - 44;
      if (top < margin) top = rect.bottom + 8;
      setPos({ top, left });
      rangeRef.current = range.cloneRange();
      hostRef.current = host;
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [mode]);

  // Apply inline style to the current range. Wraps the selected nodes
  // in a fresh <span>; if the range crosses node boundaries (so
  // surroundContents would throw), fall back to extractContents +
  // insert which is permissive.
  const applyStyle = (style: { color?: string; fontSize?: string }) => {
    const range = rangeRef.current;
    const host = hostRef.current;
    if (!range || !host) return;

    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);

    const span = document.createElement("span");
    if (style.color) span.style.color = style.color;
    if (style.fontSize) span.style.fontSize = style.fontSize;
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }

    // Re-select the wrapping span so the operator can stack another
    // change (e.g. set colour then size) without re-highlighting.
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
    rangeRef.current = newRange.cloneRange();

    // Synthetic input event so the host's onInput-style handler fires
    // immediately. The host's onBlur save still runs when focus
    // eventually leaves; this just gives a faster preview.
    host.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const onColor = (value: string) => applyStyle({ color: value });
  const onSize = (value: string) => {
    const n = parseInt(value, 10);
    if (!isFinite(n) || n < 6 || n > 200) return;
    applyStyle({ fontSize: `${n}px` });
  };

  if (mode !== "editor" || !pos || typeof window === "undefined") return null;

  return createPortal(
    <div
      data-editor-chrome
      className="fixed z-[10000] bg-white rounded-xl shadow-xl border border-black/10 p-1.5 flex items-center gap-1.5 ss-popover-in"
      style={{ top: pos.top, left: pos.left, width: 280 }}
      onMouseDown={(e) => {
        // Prevent the contentEditable from losing focus / clearing
        // selection when the operator clicks a toolbar control.
        e.preventDefault();
      }}
    >
      {/* Colour swatches */}
      {PRESET_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onColor(c.value)}
          className="w-5 h-5 rounded-full border border-black/15 hover:scale-110 transition"
          style={{ background: c.value }}
        />
      ))}

      {/* Divider */}
      <span aria-hidden className="w-px h-5 bg-black/10 mx-0.5" />

      {/* Numeric font-size input — type any pixel value. */}
      <input
        type="number"
        min={6}
        max={200}
        placeholder="Size"
        value={sizeInput}
        onChange={(e) => setSizeInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSize(sizeInput);
          }
        }}
        onBlur={() => {
          if (sizeInput) onSize(sizeInput);
        }}
        className="w-14 text-[12px] text-center border border-black/10 rounded-md py-1 outline-none focus:border-[#1b3a2d]"
      />
      <span className="text-[10px] text-black/35 -ml-0.5">px</span>
    </div>,
    document.body,
  );
}
