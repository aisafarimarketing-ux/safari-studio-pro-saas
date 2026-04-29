"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── ContactCards ────────────────────────────────────────────────────────
//
// Three pill-style cards — Phone, Email, WhatsApp — used in the bottom
// strip of the Personal Note section. Each card has a circular icon
// chip on the left and a "Title / value" text stack on the right.
//
// Icons are inline SVGs (no react-icons dep): Lucide-style outlines for
// phone + mail; the official simple-icons WhatsApp glyph for brand
// recognition. Stroke colour comes from currentColor so the chip's text
// colour can drive the icon colour without extra plumbing.
//
// Editor mode adds:
//   - Click-to-edit on each card's value (the contentEditable span shows
//     "Add phone…" placeholder when blank, mirroring the ContactRow
//     pattern in PersonalNoteSection).
//   - A small "Style" affordance that appears on hover — opens a popover
//     with two swatch rows: chip background + chip icon. Saved per
//     section as content.contactIconBg / .contactIconColor.
//
// Visuals: rounded-2xl, soft shadow, hover lift + shadow bump, ~150ms
// ease-out — Shadcn / Framer caliber.

export type ContactCardsValues = {
  phone?: string;
  email?: string;
  whatsapp?: string;
};

export type ContactCardsStyle = {
  iconColor?: string;
  iconBg?: string;
};

const DEFAULT_ICON_BG = "rgba(31, 58, 58, 0.08)";   // muted teal tint
const DEFAULT_ICON_COLOR = "#1f3a3a";                // brand teal

export function ContactCards({
  values,
  style,
  isEditor,
  onValueChange,
  onStyleChange,
}: {
  values: ContactCardsValues;
  style: ContactCardsStyle;
  isEditor: boolean;
  onValueChange: (next: ContactCardsValues) => void;
  onStyleChange: (next: ContactCardsStyle) => void;
}) {
  const iconColor = style.iconColor || DEFAULT_ICON_COLOR;
  const iconBg = style.iconBg || DEFAULT_ICON_BG;

  return (
    <div className="relative group w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        <Card
          title="Phone"
          value={values.phone}
          placeholder="Add phone in settings"
          icon={<PhoneIcon />}
          iconColor={iconColor}
          iconBg={iconBg}
          isEditor={isEditor}
          onCommit={(v) => onValueChange({ ...values, phone: v })}
        />
        <Card
          title="Email"
          value={values.email}
          placeholder="Add email in settings"
          icon={<MailIcon />}
          iconColor={iconColor}
          iconBg={iconBg}
          isEditor={isEditor}
          onCommit={(v) => onValueChange({ ...values, email: v })}
        />
        <Card
          title="WhatsApp"
          value={values.whatsapp}
          placeholder="Add WhatsApp in settings"
          icon={<WhatsAppIcon />}
          iconColor={iconColor}
          iconBg={iconBg}
          isEditor={isEditor}
          onCommit={(v) => onValueChange({ ...values, whatsapp: v })}
        />
      </div>

      {/* Editor-only style affordance — sits over the cards row, fades
          in on hover of any card. Uses the same portal pattern as the
          cover logo controls so the popover escapes any overflow:hidden
          parent. */}
      {isEditor && (
        <StyleControl
          iconColor={iconColor}
          iconBg={iconBg}
          onChange={onStyleChange}
        />
      )}
    </div>
  );
}

// ─── One card ────────────────────────────────────────────────────────────

function Card({
  title,
  value,
  placeholder,
  icon,
  iconColor,
  iconBg,
  isEditor,
  onCommit,
}: {
  title: string;
  value: string | undefined;
  placeholder: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  isEditor: boolean;
  onCommit: (next: string | undefined) => void;
}) {
  return (
    <div
      className="group relative flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)] hover:-translate-y-[1px] transition-all duration-200"
      style={{ border: "1px solid rgba(16,24,40,0.06)" }}
    >
      <div
        className="shrink-0 flex items-center justify-center rounded-full transition-colors duration-200"
        style={{
          width: 38,
          height: 38,
          background: iconBg,
          color: iconColor,
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[#101828] leading-tight">
          {title}
        </div>
        <span
          className="block mt-0.5 text-[12px] text-black/45 leading-tight outline-none truncate"
          contentEditable={isEditor}
          suppressContentEditableWarning
          data-placeholder={isEditor ? placeholder : ""}
          onBlur={(e) => {
            const next = e.currentTarget.textContent?.trim() || "";
            onCommit(next || undefined);
          }}
        >
          {value || ""}
        </span>
      </div>
    </div>
  );
}

// ─── Style control (icon + chip colour pickers) ──────────────────────────

function StyleControl({
  iconColor,
  iconBg,
  onChange,
}: {
  iconColor: string;
  iconBg: string;
  onChange: (next: ContactCardsStyle) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      if (ref.current) setAnchor(ref.current.getBoundingClientRect());
    };
    recompute();
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute -top-3 right-0 px-2.5 py-1 rounded-full bg-black/80 text-white text-[10.5px] font-semibold shadow-md hover:bg-black transition-all duration-150 opacity-0 group-hover:opacity-100 backdrop-blur-sm flex items-center gap-1.5"
        title="Customise contact card colours"
        style={{ zIndex: 5 }}
      >
        <PaletteIcon />
        Style
      </button>

      {open && anchor &&
        createPortal(
          <StylePopover
            anchor={anchor}
            iconColor={iconColor}
            iconBg={iconBg}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

const CHIP_BG_PRESETS = [
  { label: "Stone", value: "rgba(16, 24, 40, 0.05)" },
  { label: "Cream", value: "rgba(245, 232, 216, 0.7)" },
  { label: "Teal", value: "rgba(31, 58, 58, 0.08)" },
  { label: "Sage", value: "rgba(45, 90, 64, 0.10)" },
  { label: "Gold", value: "rgba(201, 168, 76, 0.16)" },
  { label: "Charcoal", value: "rgba(0, 0, 0, 0.85)" },
];

const ICON_COLOR_PRESETS = [
  { label: "Charcoal", value: "#101828" },
  { label: "Teal", value: "#1f3a3a" },
  { label: "Sage", value: "#2d5a40" },
  { label: "Gold", value: "#c9a84c" },
  { label: "Copper", value: "#b06a3b" },
  { label: "Cream", value: "#f5e8d8" },
];

function StylePopover({
  anchor,
  iconColor,
  iconBg,
  onChange,
  onClose,
}: {
  anchor: DOMRect;
  iconColor: string;
  iconBg: string;
  onChange: (next: ContactCardsStyle) => void;
  onClose: () => void;
}) {
  const W = 280;
  const left = Math.max(8, Math.min(anchor.right - W, window.innerWidth - W - 8));
  const top = anchor.bottom + 8;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 10000 }}
      />
      <div
        className="ss-popover-in"
        style={{
          position: "fixed",
          top,
          left,
          width: W,
          zIndex: 10001,
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-black/8 overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-black/45 mb-2">
              Icon chip
            </div>
            <SwatchRow
              presets={CHIP_BG_PRESETS}
              current={iconBg}
              onPick={(v) => onChange({ iconBg: v, iconColor })}
            />
          </div>
          <div className="border-t border-black/6 px-4 pt-3 pb-4">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-black/45 mb-2">
              Icon colour
            </div>
            <SwatchRow
              presets={ICON_COLOR_PRESETS}
              current={iconColor}
              onPick={(v) => onChange({ iconBg, iconColor: v })}
            />
            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={hexFrom(iconColor) || "#101828"}
                onChange={(e) => onChange({ iconBg, iconColor: e.target.value })}
                className="w-7 h-7 rounded border border-black/10 cursor-pointer p-0"
                title="Custom icon colour"
              />
              <span className="text-[11px] text-black/45">Custom hex</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SwatchRow({
  presets,
  current,
  onPick,
}: {
  presets: Array<{ label: string; value: string }>;
  current: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((p) => (
        <button
          key={p.value}
          type="button"
          title={p.label}
          onClick={() => onPick(p.value)}
          className={`w-7 h-7 rounded-full transition ${
            current === p.value
              ? "ring-2 ring-[#1b3a2d] ring-offset-1"
              : "hover:scale-105"
          }`}
          style={{
            background: p.value,
            border:
              current === p.value
                ? "1px solid rgba(255,255,255,0.6)"
                : "1px solid rgba(0,0,0,0.08)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// Official simple-icons WhatsApp path. Filled glyph reads instantly as
// the WhatsApp brand mark.
function WhatsAppIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

// Strip rgba/hex variants down to a 6-char hex for <input type="color">.
function hexFrom(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const t = color.trim();
  if (t.startsWith("#")) return t.length === 7 ? t : undefined;
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(t);
  if (!m) return undefined;
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(parseInt(m[1], 10))}${toHex(parseInt(m[2], 10))}${toHex(parseInt(m[3], 10))}`;
}
