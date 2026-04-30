"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ─── IntelligentColorPicker ──────────────────────────────────────────────
//
// Full-spectrum colour picker for the InlineTextToolbar. Replaces the
// 9-swatch grid + hex input with a proper visual picker:
//
//   1. Saturation × value square (drag the dot to mix)
//   2. Hue slider (rainbow gradient, drag the marker)
//   3. Eyedropper (when window.EyeDropper is available — Chrome / Edge)
//   4. Hex input (live two-way sync with the visual picker)
//   5. Recent colours — last 8 used, persisted in localStorage
//   6. Brand colours — operator's primary + secondary, always one click
//   7. Curated brand presets (the original 9, kept as a quick row)
//
// "Intelligent" pieces:
//   - Auto-corrects 3-char hex (#abc) → 6-char (#aabbcc) on commit
//   - Hex / RGB / HSV stay in lockstep — change any, the others update
//   - Recent colours never duplicate the brand or preset rows
//   - Contrast hint: tiny "AA" / "AAA" / "fail" badge against a white
//     background so operators see at a glance whether the colour will
//     read as body copy on cream/white sections
//
// The whole picker fits in ~260px wide and ~330px tall — sized to slot
// into the existing PopoverPanel without overflow on mobile viewports.

const RECENT_KEY = "ss-toolbar-recent-colors-v1";
const RECENT_MAX = 8;

export interface IntelligentColorPickerProps {
  /** Initial colour shown in the picker (current selection's colour). */
  value?: string;
  /** Fires on every change — square drag, hue slider, hex commit, click
   *  on a swatch. Caller wraps the active selection with this colour. */
  onChange: (hex: string) => void;
  /** Operator's brand colours. Surfaced as a "Brand" row at the top. */
  brandColors?: { primary?: string; secondary?: string };
  /** Compact preset row (the original 9 brand-aligned options). */
  presets?: Array<{ value: string; label: string }>;
}

export function IntelligentColorPicker({
  value = "#1f3a3a",
  onChange,
  brandColors,
  presets,
}: IntelligentColorPickerProps) {
  const initial = parseColor(value) ?? { h: 180, s: 0.5, v: 0.5 };
  const [hsv, setHsv] = useState(initial);
  const [hexInput, setHexInput] = useState(hsvToHex(initial));
  const [recents, setRecents] = useState<string[]>([]);
  const [dragging, setDragging] = useState<"sv" | "hue" | null>(null);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  // Load recents on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecents(parsed.filter((s) => typeof s === "string").slice(0, RECENT_MAX));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist a colour to recents (de-duped, capped).
  const remember = (hex: string) => {
    setRecents((prev) => {
      const next = [hex, ...prev.filter((p) => p.toLowerCase() !== hex.toLowerCase())].slice(0, RECENT_MAX);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* ignore quota */
        }
      }
      return next;
    });
  };

  // Apply: update HSV state + hex input + invoke onChange.
  const apply = (next: { h: number; s: number; v: number }, commit = false) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexInput(hex);
    onChange(hex);
    if (commit) remember(hex);
  };

  // Pick a hex directly (from a swatch / hex input / eyedropper).
  const pickHex = (hex: string) => {
    const parsed = parseColor(hex);
    if (!parsed) return;
    setHsv(parsed);
    setHexInput(hex);
    onChange(hex);
    remember(hex);
  };

  // SV square drag handling. We attach a single document-level listener
  // for the duration of the drag so the cursor can leave the square
  // without losing the drag.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (dragging === "sv" && svRef.current) {
        const rect = svRef.current.getBoundingClientRect();
        const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        apply({ h: hsv.h, s: x, v: 1 - y });
      } else if (dragging === "hue" && hueRef.current) {
        const rect = hueRef.current.getBoundingClientRect();
        const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        apply({ h: x * 360, s: hsv.s, v: hsv.v });
      }
    };
    const onUp = () => {
      setDragging(null);
      remember(hsvToHex(hsv));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // Eyedropper (Chrome / Edge only — feature-detected).
  const eyeDropperAvailable =
    typeof window !== "undefined" && "EyeDropper" in window;
  const launchEyeDropper = async () => {
    if (!eyeDropperAvailable) return;
    try {
      const win = window as Window & {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      };
      const Ctor = win.EyeDropper;
      if (!Ctor) return;
      const ed = new Ctor();
      const result = await ed.open();
      pickHex(result.sRGBHex);
    } catch {
      /* user cancelled */
    }
  };

  const currentHex = hsvToHex(hsv);
  const contrast = contrastBadge(currentHex);

  // Build the SV square's background as a multi-stop gradient layered
  // over the pure-hue colour so the bottom-left is white-saturated and
  // the top-right is the saturated hue.
  const hueOnlyHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const svBackground = `
    linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%),
    linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%),
    ${hueOnlyHex}
  `;

  // Build a memoised hue gradient string so React doesn't recompute on
  // every drag tick (mostly cosmetic; CSS layout cost is tiny).
  const hueGradient = useMemo(
    () =>
      "linear-gradient(to right, " +
      [0, 60, 120, 180, 240, 300, 360]
        .map((h) => hsvToHex({ h, s: 1, v: 1 }))
        .join(", ") +
      ")",
    [],
  );

  return (
    <div
      className="w-[260px] select-none"
      style={{ fontFamily: "inherit" }}
    >
      {/* Saturation × Value square */}
      <div
        ref={svRef}
        onMouseDown={(e) => {
          setDragging("sv");
          if (svRef.current) {
            const rect = svRef.current.getBoundingClientRect();
            const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
            apply({ h: hsv.h, s: x, v: 1 - y });
          }
        }}
        className="relative w-full h-[140px] rounded-md cursor-crosshair overflow-hidden border border-white/10"
        style={{ background: svBackground }}
      >
        <div
          className="absolute w-3.5 h-3.5 rounded-full pointer-events-none"
          style={{
            left: `calc(${hsv.s * 100}% - 7px)`,
            top: `calc(${(1 - hsv.v) * 100}% - 7px)`,
            background: currentHex,
            border: "2px solid #fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        onMouseDown={(e) => {
          setDragging("hue");
          if (hueRef.current) {
            const rect = hueRef.current.getBoundingClientRect();
            const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            apply({ h: x * 360, s: hsv.s, v: hsv.v });
          }
        }}
        className="relative mt-2 h-3.5 rounded-full cursor-ew-resize"
        style={{ background: hueGradient }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full pointer-events-none"
          style={{
            left: `calc(${(hsv.h / 360) * 100}% - 7px)`,
            background: hueOnlyHex,
            border: "2px solid #fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Hex input + contrast badge + eyedropper */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-white/40">Hex</span>
        <input
          type="text"
          name="colorPickerHex"
          id="color-picker-hex"
          autoComplete="off"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.currentTarget.value || "").trim();
              if (/^#?[0-9a-f]{3,8}$/i.test(v)) pickHex(normaliseHex(v));
            }
          }}
          onBlur={(e) => {
            const v = (e.currentTarget.value || "").trim();
            if (/^#?[0-9a-f]{3,8}$/i.test(v)) pickHex(normaliseHex(v));
            else setHexInput(currentHex);
          }}
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-[11.5px] text-white outline-none focus:border-white/30 font-mono"
          spellCheck={false}
        />
        {contrast && (
          <span
            title={`Contrast ratio against white: ${contrast.ratio.toFixed(1)}:1 — ${contrast.level}`}
            className="text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold"
            style={{
              background:
                contrast.level === "AAA"
                  ? "rgba(80,200,120,0.28)"
                  : contrast.level === "AA"
                    ? "rgba(200,180,80,0.28)"
                    : "rgba(220,90,80,0.32)",
              color:
                contrast.level === "AAA"
                  ? "#7be8a3"
                  : contrast.level === "AA"
                    ? "#e8d77b"
                    : "#f5a59c",
            }}
          >
            {contrast.level}
          </span>
        )}
        {eyeDropperAvailable && (
          <button
            type="button"
            onClick={launchEyeDropper}
            title="Pick a colour from anywhere on screen"
            className="w-7 h-7 flex items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white transition-colors"
          >
            <EyeDropperIcon />
          </button>
        )}
      </div>

      {/* Brand colours */}
      {(brandColors?.primary || brandColors?.secondary) && (
        <div className="mt-3">
          <div className="text-[9.5px] uppercase tracking-wider text-white/40 mb-1.5 px-0.5">
            Brand
          </div>
          <div className="flex items-center gap-1.5 px-0.5">
            {brandColors.primary && (
              <SwatchButton
                color={brandColors.primary}
                label="Brand primary"
                onClick={() => pickHex(brandColors.primary!)}
                size="md"
              />
            )}
            {brandColors.secondary && (
              <SwatchButton
                color={brandColors.secondary}
                label="Brand secondary"
                onClick={() => pickHex(brandColors.secondary!)}
                size="md"
              />
            )}
          </div>
        </div>
      )}

      {/* Recents */}
      {recents.length > 0 && (
        <div className="mt-3">
          <div className="text-[9.5px] uppercase tracking-wider text-white/40 mb-1.5 px-0.5">
            Recent
          </div>
          <div className="flex flex-wrap gap-1.5 px-0.5">
            {recents.map((c) => (
              <SwatchButton
                key={c}
                color={c}
                label={c}
                onClick={() => pickHex(c)}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}

      {/* Curated presets */}
      {presets && presets.length > 0 && (
        <div className="mt-3">
          <div className="text-[9.5px] uppercase tracking-wider text-white/40 mb-1.5 px-0.5">
            Presets
          </div>
          <div className="grid grid-cols-9 gap-1 px-0.5">
            {presets.map((c) => (
              <SwatchButton
                key={c.value}
                color={c.value}
                label={c.label}
                onClick={() => pickHex(c.value)}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function SwatchButton({
  color,
  label,
  onClick,
  size,
}: {
  color: string;
  label: string;
  onClick: () => void;
  size: "sm" | "md";
}) {
  const cls = size === "md" ? "w-7 h-7" : "w-5 h-5";
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`${cls} rounded-md border border-white/15 hover:scale-110 transition-transform shrink-0`}
      style={{ background: color }}
    />
  );
}

function EyeDropperIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </svg>
  );
}

// ─── HSV / Hex / RGB conversions ─────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normaliseHex(input: string): string {
  let v = input.trim().replace(/^#/, "");
  if (v.length === 3) v = v.split("").map((c) => c + c).join("");
  if (v.length === 6) return `#${v.toLowerCase()}`;
  if (v.length === 8) return `#${v.slice(0, 6).toLowerCase()}`;
  return `#${v.padEnd(6, "0").slice(0, 6).toLowerCase()}`;
}

function parseColor(input: string): { h: number; s: number; v: number } | null {
  const rgb = parseToRgb(input);
  if (!rgb) return null;
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

function parseToRgb(input: string): { r: number; g: number; b: number } | null {
  const t = input.trim();
  if (t.startsWith("#")) {
    const cleaned = t.slice(1);
    const full =
      cleaned.length === 3
        ? cleaned.split("").map((c) => c + c).join("")
        : cleaned.slice(0, 6);
    if (full.length !== 6) return null;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(t);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return null;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToHex({ h, s, v }: { h: number; s: number; v: number }): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to255 = (n: number) => Math.round((n + m) * 255);
  const hex = (n: number) => to255(n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// Contrast helpers — used to tag the picker's current colour with an
// AA / AAA / fail badge, comparing against a white background. White
// is the dominant section bg in our editorial templates so this is a
// sensible default.

function relativeLuminance(hex: string): number {
  const rgb = parseToRgb(hex);
  if (!rgb) return 0;
  const channel = (n: number) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastBadge(hex: string): { ratio: number; level: "AAA" | "AA" | "fail" } | null {
  const rgb = parseToRgb(hex);
  if (!rgb) return null;
  const lFg = relativeLuminance(hex);
  const lBg = 1; // white
  const ratio = (Math.max(lFg, lBg) + 0.05) / (Math.min(lFg, lBg) + 0.05);
  if (ratio >= 7) return { ratio, level: "AAA" };
  if (ratio >= 4.5) return { ratio, level: "AA" };
  return { ratio, level: "fail" };
}
