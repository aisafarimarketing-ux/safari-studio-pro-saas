"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

// Floating AI toolbar that appears when the user highlights text anywhere
// inside an [data-ai-editable] element in the editor canvas. Offers:
//   - Rewrite
//   - Shorten
//   - Lengthen
//   - Tone → menu with warm / formal / brief / playful / poetic
//
// Selected text is sent to /api/ai/rewrite. The returned string replaces
// the selection in-DOM (contentEditable) and then fires an 'input' event
// so the section's onBlur save fires naturally.
//
// The toolbar doesn't care which section the text lives in — any
// contentEditable inside a [data-ai-editable] wrapper works. Each section
// that wants the behaviour just adds the wrapper attribute.

type ToolState =
  | { status: "idle" }
  | { status: "working"; action: string }
  | { status: "error"; message: string };

export function AISelectionToolbar() {
  const { mode } = useEditorStore();
  const [state, setState] = useState<ToolState>({ status: "idle" });
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [toneOpen, setToneOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<{ text: string; range: Range } | null>(null);

  useEffect(() => {
    if (mode !== "editor") {
      setVisible(false);
      return;
    }
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setVisible(false);
        }
        return;
      }
      const text = sel.toString();
      if (text.trim().length < 8) {
        setVisible(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.startContainer.parentElement;
      // Only show inside an AI-opted-in editable region.
      const editable = node?.closest<HTMLElement>("[data-ai-editable]");
      if (!editable) {
        setVisible(false);
        return;
      }
      selectionRef.current = { text, range: range.cloneRange() };
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setPos({
        top: window.scrollY + rect.top - 44,
        left: window.scrollX + rect.left + rect.width / 2,
      });
      setVisible(true);
      setState({ status: "idle" });
    };

    document.addEventListener("selectionchange", onSelect);
    const onClick = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      // Hide if user clicked outside without selecting anything new.
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setVisible(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("selectionchange", onSelect);
      document.removeEventListener("mousedown", onClick);
    };
  }, [mode]);

  const act = async (action: "rewrite" | "shorten" | "lengthen" | "tone", tone?: string) => {
    const sel = selectionRef.current;
    if (!sel) return;
    setState({ status: "working", action });
    setToneOpen(false);

    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: action,
          text: sel.text,
          tone: tone,
        }),
      });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const { text } = (await res.json()) as { text: string };
      replaceSelection(sel.range, text);
      setVisible(false);
      setState({ status: "idle" });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Rewrite failed" });
      setTimeout(() => setState({ status: "idle" }), 3000);
    }
  };

  if (!visible || mode !== "editor") return null;

  const busy = state.status === "working";
  const label =
    state.status === "working"
      ? `${labelFor(state.action)}…`
      : state.status === "error"
        ? state.message
        : "";

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[60] -translate-x-1/2 flex items-center gap-1 bg-white border border-black/10 rounded-xl shadow-xl ss-popover-in"
      style={{ top: pos.top, left: pos.left, padding: "4px" }}
      onMouseDown={(e) => e.preventDefault()}
      data-editor-chrome
    >
      {busy ? (
        <div className="px-3 py-1.5 text-[12px] text-black/60">{label}</div>
      ) : state.status === "error" ? (
        <div className="px-3 py-1.5 text-[12px] text-[#b34334]">{label}</div>
      ) : (
        <>
          <ToolbarButton onClick={() => act("rewrite")} icon="✦" label="Rewrite" />
          <ToolbarButton onClick={() => act("shorten")} icon="—" label="Shorten" />
          <ToolbarButton onClick={() => act("lengthen")} icon="+" label="Lengthen" />
          <div className="relative">
            <ToolbarButton
              onClick={() => setToneOpen((o) => !o)}
              icon="◐"
              label="Tone"
              active={toneOpen}
            />
            {toneOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-white border border-black/10 rounded-lg shadow-xl py-1 min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                {(["warm", "formal", "brief", "playful", "poetic"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => act("tone", t)}
                    className="w-full text-left px-3 py-1.5 text-[13px] text-black/75 hover:bg-black/[0.04] transition capitalize"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition ${
        active ? "bg-[#1b3a2d] text-white" : "text-black/70 hover:bg-black/[0.05]"
      }`}
    >
      <span className={active ? "" : "text-[#c9a84c]"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function labelFor(action: string): string {
  if (action === "rewrite") return "Rewriting";
  if (action === "shorten") return "Shortening";
  if (action === "lengthen") return "Expanding";
  if (action === "tone") return "Adjusting tone";
  return "Working";
}

function replaceSelection(range: Range, text: string) {
  // Preserve the contentEditable root so we can dispatch input on it
  // (triggers React's onBlur-equivalent change tracking).
  const editable = range.startContainer.parentElement?.closest<HTMLElement>(
    "[contenteditable]",
  );
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  // Move caret to end of inserted text.
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  if (editable) {
    editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
    // Fire blur so the section's onBlur handler persists the change.
    editable.blur();
    editable.focus();
    editable.blur();
  }
}
