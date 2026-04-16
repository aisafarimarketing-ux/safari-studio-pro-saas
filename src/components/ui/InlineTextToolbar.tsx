"use client";

import { useEffect, useState, useCallback } from "react";
import { ColorPickerPopover } from "./ColorPickerPopover";

interface ToolbarPos {
  top: number;
  left: number;
}

export function InlineTextToolbar() {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<ToolbarPos>({ top: 0, left: 0 });
  const [color, setColor] = useState("#000000");

  const update = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setVisible(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0) {
      setVisible(false);
      return;
    }
    setPos({
      top: rect.top + window.scrollY - 44,
      left: rect.left + window.scrollX + rect.width / 2,
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [update]);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed z-[60] flex items-center gap-0.5 bg-[#1a1a1a] rounded-lg px-2 py-1.5 shadow-xl pointer-events-auto"
      style={{
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolBtn onClick={() => exec("bold")} title="Bold">
        <strong>B</strong>
      </ToolBtn>
      <ToolBtn onClick={() => exec("italic")} title="Italic">
        <em>I</em>
      </ToolBtn>
      <div className="w-px h-4 bg-white/20 mx-1" />
      <ToolBtn onClick={() => exec("fontSize", "5")} title="Larger">
        A+
      </ToolBtn>
      <ToolBtn onClick={() => exec("fontSize", "3")} title="Smaller">
        A-
      </ToolBtn>
      <div className="w-px h-4 bg-white/20 mx-1" />
      <ColorPickerPopover
        value={color}
        onChange={(c) => {
          setColor(c);
          exec("foreColor", c);
        }}
      >
        <span className="text-white text-sm px-1.5 py-0.5 rounded hover:bg-white/15 transition cursor-pointer flex items-center gap-1">
          A
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: color }}
          />
        </span>
      </ColorPickerPopover>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="text-white text-sm px-1.5 py-0.5 rounded hover:bg-white/20 transition"
    >
      {children}
    </button>
  );
}
