"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";

interface ColorPickerPopoverProps {
  value: string;
  onChange: (color: string) => void;
  onClose?: () => void;
  brandColors?: string[];
  label?: string;
  children: React.ReactNode;
}

const RECENT_KEY = "ss_recent_colors";

function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addRecent(color: string) {
  const recent = getRecent().filter((c) => c !== color).slice(0, 7);
  localStorage.setItem(RECENT_KEY, JSON.stringify([color, ...recent]));
}

export function ColorPickerPopover({
  value,
  onChange,
  onClose,
  brandColors = [],
  label,
  children,
}: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setRecent(getRecent());
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onClose?.();
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        onClose?.();
      }
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      document.addEventListener("keydown", esc);
    }
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  const handleChange = useCallback(
    (color: string) => {
      onChange(color);
      addRecent(color);
    },
    [onChange]
  );

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5"
      >
        {children}
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-black/10 p-4 w-60 ss-popover-in"
          style={{ minWidth: 220 }}
        >
          {label && (
            <div className="text-[11px] uppercase tracking-widest text-black/40 mb-3">
              {label}
            </div>
          )}

          <HexColorPicker
            color={value}
            onChange={handleChange}
            style={{ width: "100%", height: 140 }}
          />

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-black/40">#</span>
            <HexColorInput
              color={value}
              onChange={handleChange}
              className="flex-1 text-sm border border-black/15 rounded-md px-2 py-1 font-mono uppercase"
              prefixed={false}
            />
            <div
              className="w-7 h-7 rounded-md border border-black/15 shrink-0"
              style={{ background: value }}
            />
          </div>

          {brandColors.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-black/35 mb-1.5">
                Brand
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brandColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleChange(c)}
                    className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                    style={{
                      background: c,
                      borderColor: value === c ? "#000" : "transparent",
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-black/35 mb-1.5">
                Recent
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleChange(c)}
                    className="w-6 h-6 rounded-full border border-black/10 transition hover:scale-110"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
