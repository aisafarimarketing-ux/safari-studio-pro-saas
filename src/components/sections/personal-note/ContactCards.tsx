"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── ContactCards ────────────────────────────────────────────────────────
//
// Three pill-style cards — Phone, Email, WhatsApp — used in the bottom
// strip of the Personal Note section and in the Footer's contact-cards
// variant. Each card pairs a circular icon chip with a "Title / value"
// stack — Phone, Email, WhatsApp.
//
// Three render modes share one component:
//
//   1. EDITOR  — three labelled inputs sit above the cards; the cards
//      themselves are display-only (no inline contentEditable). Operators
//      type into the inputs, see the cards update live, and a "🎨 Style"
//      affordance reveals on hover for chip / icon / card-background
//      colour customisation.
//
//   2. PREVIEW (share view) — inputs strip is gone; cards become real
//      anchors with tel: / mailto: / wa.me hrefs so clients tap to call,
//      mail, or chat. Cards with no value are hidden entirely so the row
//      doesn't show "Phone — empty" placeholders.
//
//   3. PRINT / PDF — print CSS hides the cards row entirely; in its
//      place, a single tracked-out small-caps line renders the values
//      as plain text ("+255 712 … · operator@safari.com · WhatsApp +255
//      712 …"). Tiny icons render unreliably across PDF engines and add
//      nothing to a printed deck.
//
// Icons: Lucide-style outlines for Phone + Mail; the official simple-
// icons WhatsApp glyph (filled). The WhatsApp glyph is rendered slightly
// smaller (15px vs 18px) so its filled mass matches the visual weight of
// the outline phone/mail glyphs in the same chip.
//
// ─── Visibility rules — DO NOT REGRESS ───────────────────────────────────
//
//   1. ALL THREE CARDS render together as a unit. In editor mode the
//      row is always present so operators see the full layout. In
//      preview/share the row renders if ANY of phone/email/whatsapp is
//      set; individual empty cards show an em-dash rather than
//      vanishing. Operators reported "icons missing in preview" when
//      we hid empty cards one by one — the gap looked broken even
//      though it was by design.
//   2. The PRINT FALLBACK row uses explicit @media print rules in
//      globals.css (.ss-contact-print-only / .ss-contact-screen-only)
//      rather than Tailwind's `print:` modifiers, so the screen/print
//      switch can't be broken by a Tailwind config change or build
//      environment quirk.
//   3. AUTO-CONTRAST GUARD on the icon chip: when iconColor and iconBg
//      brightness are too close (operator picks white-on-white), fall
//      back to a high-contrast pair anchored off the iconBg luminance
//      so the glyph never renders invisibly in preview.
//   4. The EDITOR INPUTS strip is the ONLY element gated by isEditor.
//      The cards row, print fallback, and Style picker pill are not.
//
// See memory/map_and_routing_rules.md → "Personal Note contact rules".
// ──────────────────────────────────────────────────────────────────────────

export type ContactCardsValues = {
  phone?: string;
  email?: string;
  whatsapp?: string;
};

export type ContactCardsStyle = {
  iconColor?: string;
  iconBg?: string;
  cardBg?: string;
};

const DEFAULT_ICON_BG = "rgba(31, 58, 58, 0.08)";   // muted teal tint
const DEFAULT_ICON_COLOR = "#1f3a3a";                // brand teal
const DEFAULT_CARD_BG = "#ffffff";                   // white pill

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
  const cardBg = style.cardBg || DEFAULT_CARD_BG;

  // Defensive strip: operators sometimes type "Phone: +255 …" or
  // "Email: hello@…" into the inputs by habit, even though the card
  // already shows the label. Strip any leading "Label:" so the cards
  // and the tel:/mailto:/wa.me links always carry the clean value —
  // no support tickets about broken click-to-call later.
  const phone = stripLabel("phone", values.phone);
  const email = stripLabel("email", values.email);
  const whatsapp = stripLabel("whatsapp", values.whatsapp);

  // wa.me requires digits-only; strip everything else for the href but
  // keep the operator's formatted number for display.
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`
    : "";

  const cards: CardSpec[] = [
    {
      title: "Phone",
      value: phone,
      href: phone ? `tel:${phone.replace(/\s+/g, "")}` : "",
      icon: <PhoneIcon />,
      multiline: false,
    },
    {
      title: "Email",
      value: email,
      href: email ? `mailto:${email}` : "",
      icon: <MailIcon />,
      // Long addresses ("ops@africansafariexperience.com") would
      // ellipsize even at 300px per card. Wrap to 2 lines instead so
      // operators don't have to shorten their email to fit.
      multiline: true,
    },
    {
      title: "WhatsApp",
      value: whatsapp,
      href: whatsappHref,
      icon: <WhatsAppIcon />,
      multiline: false,
    },
  ];

  // Plain-text print line. WhatsApp gets a label because a bare number
  // wouldn't tell the reader it's chat-specific; phone/email are
  // self-explanatory.
  const printParts = [
    phone || "",
    email || "",
    whatsapp ? `WhatsApp ${whatsapp}` : "",
  ].filter(Boolean);

  // Card visibility — fundamental rule: if the operator has typed ANY
  // contact value, render all three icons + cards. Empty cards in
  // preview show an em-dash placeholder rather than vanishing, because
  // operators consistently reported "icons missing in preview" when
  // we hid empty cards individually — the gap between cards looked
  // like a render failure even though it was by design. In editor we
  // always render all three so operators see the full row.
  const anyValueSet = !!(phone || email || whatsapp);
  const visibleCards = isEditor || anyValueSet ? cards : [];

  return (
    <div className="relative group w-full">
      {/* Editor-only inputs strip — three labelled fields the operator
          types into. Live-binds to onValueChange so the cards below
          update on every keystroke. Hidden in preview/share/print. */}
      {isEditor && (
        <div className="ss-contact-screen-only grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <ContactInput
            label="Phone"
            icon={<PhoneIcon />}
            placeholder="+255 712 345 678"
            value={values.phone}
            onChange={(v) => onValueChange({ ...values, phone: v })}
          />
          <ContactInput
            label="Email"
            icon={<MailIcon />}
            placeholder="hello@safari.com"
            value={values.email}
            onChange={(v) => onValueChange({ ...values, email: v })}
            inputType="email"
          />
          <ContactInput
            label="WhatsApp"
            icon={<WhatsAppIcon size={14} />}
            placeholder="+255 712 345 678"
            value={values.whatsapp}
            onChange={(v) => onValueChange({ ...values, whatsapp: v })}
          />
        </div>
      )}

      {/* Cards row — display only. In preview each card is an anchor
          with the right href; in editor each card is a div. Cards with
          no value are hidden in preview so empty slots don't show. */}
      {visibleCards.length > 0 && (
        <div
          data-contact-cards
          className="ss-contact-screen-only grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {visibleCards.map((c) => (
            <Card
              key={c.title}
              title={c.title}
              value={c.value}
              href={c.href}
              icon={c.icon}
              iconColor={iconColor}
              iconBg={iconBg}
              cardBg={cardBg}
              isEditor={isEditor}
              multiline={c.multiline}
            />
          ))}
        </div>
      )}

      {/* Print-only plain-text line. Centered, tracked-out small caps
          to match editorial register. */}
      {printParts.length > 0 && (
        <div
          data-contact-print
          className="ss-contact-print-only text-center"
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            color: "rgba(0,0,0,0.6)",
            lineHeight: 1.6,
          }}
        >
          {printParts.join("  ·  ")}
        </div>
      )}

      {/* Style picker — editor only. Sits over the cards row top-right;
          fades in on hover. Portal'd menu so it escapes any overflow. */}
      {isEditor && (
        <StyleControl
          iconColor={iconColor}
          iconBg={iconBg}
          cardBg={cardBg}
          onChange={onStyleChange}
        />
      )}
    </div>
  );
}

type CardSpec = {
  title: string;
  value: string | undefined;
  href: string;
  icon: React.ReactNode;
  multiline: boolean;
};

// ─── One card (display-only) ─────────────────────────────────────────────

function Card({
  title,
  value,
  href,
  icon,
  iconColor,
  iconBg,
  cardBg,
  isEditor,
  multiline,
}: {
  title: string;
  value: string | undefined;
  href: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  cardBg: string;
  isEditor: boolean;
  multiline: boolean;
}) {
  const hasValue = !!value;
  const interactive = !isEditor && hasValue;

  // Auto-pick text colour against the card bg so cream / charcoal /
  // black backgrounds remain legible without per-section plumbing.
  const titleColor = textOn(cardBg, "#101828", "#ffffff");
  const valueColor = textOn(cardBg, "rgba(0,0,0,0.45)", "rgba(255,255,255,0.65)");

  // Auto-contrast guard for the icon chip — if the operator-picked
  // iconColor is too close to the iconBg in luminance, the glyph
  // renders nearly invisibly (white-on-white was the original bug
  // operators reported as "icons missing in preview"). When the
  // brightness gap is < 35, fall back to a high-contrast pair anchored
  // off the iconBg luminance: dark glyph on light chips, cream glyph
  // on dark chips. The operator's stored colour is untouched — only
  // the rendered chip is fixed.
  const ICON_MIN_CONTRAST = 35;
  const bgLum = brightness(iconBg);
  const fgLum = brightness(iconColor);
  const iconColorSafe =
    Math.abs(bgLum - fgLum) < ICON_MIN_CONTRAST
      ? bgLum > 140
        ? "#1f3a3a"
        : "#f5e8d8"
      : iconColor;

  const baseClasses =
    "flex items-center gap-3.5 px-4 py-3 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-all duration-200 no-underline";
  const interactiveClasses = interactive
    ? "hover:shadow-[0_4px_14px_rgba(16,24,40,0.1)] hover:-translate-y-[1px] cursor-pointer"
    : "";

  const cardStyle: React.CSSProperties = {
    background: cardBg,
    border: "1px solid rgba(16,24,40,0.06)",
    color: titleColor,
    textDecoration: "none",
  };

  const inner = (
    <>
      <div
        className="shrink-0 flex items-center justify-center rounded-full transition-colors duration-200"
        style={{
          width: 38,
          height: 38,
          background: iconBg,
          color: iconColorSafe,
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-semibold leading-tight"
          style={{ color: titleColor }}
        >
          {title}
        </div>
        <div
          className={`mt-0.5 text-[12px] leading-tight ${
            multiline ? "line-clamp-2 break-all" : "truncate"
          }`}
          style={{ color: valueColor }}
        >
          {value || (isEditor ? "Not set" : "—")}
        </div>
      </div>
    </>
  );

  if (interactive) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={`${baseClasses} ${interactiveClasses}`}
        style={cardStyle}
      >
        {inner}
      </a>
    );
  }

  return (
    <div className={baseClasses} style={cardStyle}>
      {inner}
    </div>
  );
}

// ─── Editor input row ────────────────────────────────────────────────────

function ContactInput({
  label,
  icon,
  placeholder,
  value,
  onChange,
  inputType = "text",
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  inputType?: "text" | "email";
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] font-semibold text-black/45 mb-1.5">
        {label}
      </span>
      <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-white border border-black/8 focus-within:border-[#1b3a2d]/40 focus-within:ring-2 focus-within:ring-[#1b3a2d]/8 transition">
        <span className="text-black/35 shrink-0" aria-hidden>
          {icon}
        </span>
        <input
          type={inputType}
          value={value ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next === "" ? undefined : next);
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-black/30"
        />
      </div>
    </label>
  );
}

// ─── Style control (icon chip / icon colour / card bg) ───────────────────

function StyleControl({
  iconColor,
  iconBg,
  cardBg,
  onChange,
}: {
  iconColor: string;
  iconBg: string;
  cardBg: string;
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
        className="ss-contact-screen-only absolute -top-3 right-0 px-2.5 py-1 rounded-full bg-black/80 text-white text-[10.5px] font-semibold shadow-md hover:bg-black transition-all duration-150 opacity-0 group-hover:opacity-100 backdrop-blur-sm flex items-center gap-1.5"
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
            cardBg={cardBg}
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

const CARD_BG_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Cream", value: "#f5e8d8" },
  { label: "Sand", value: "#ede4d3" },
  { label: "Stone", value: "#f3f3f1" },
  { label: "Charcoal", value: "#1a1a1a" },
  { label: "Black", value: "#000000" },
];

function StylePopover({
  anchor,
  iconColor,
  iconBg,
  cardBg,
  onChange,
  onClose,
}: {
  anchor: DOMRect;
  iconColor: string;
  iconBg: string;
  cardBg: string;
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
          <Section
            label="Icon chip"
            presets={CHIP_BG_PRESETS}
            current={iconBg}
            onPick={(v) => onChange({ iconBg: v, iconColor, cardBg })}
          />
          <Section
            label="Icon colour"
            presets={ICON_COLOR_PRESETS}
            current={iconColor}
            onPick={(v) => onChange({ iconBg, iconColor: v, cardBg })}
            withCustom
            onCustom={(v) => onChange({ iconBg, iconColor: v, cardBg })}
          />
          <Section
            label="Card background"
            presets={CARD_BG_PRESETS}
            current={cardBg}
            onPick={(v) => onChange({ iconBg, iconColor, cardBg: v })}
            withCustom
            onCustom={(v) => onChange({ iconBg, iconColor, cardBg: v })}
          />
        </div>
      </div>
    </>
  );
}

function Section({
  label,
  presets,
  current,
  onPick,
  withCustom,
  onCustom,
}: {
  label: string;
  presets: Array<{ label: string; value: string }>;
  current: string;
  onPick: (v: string) => void;
  withCustom?: boolean;
  onCustom?: (v: string) => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-black/6 first:border-t-0">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-black/45 mb-2">
        {label}
      </div>
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
      {withCustom && onCustom && (
        <div className="mt-2.5 flex items-center gap-2">
          <input
            type="color"
            value={hexFrom(current) || "#101828"}
            onChange={(e) => onCustom(e.target.value)}
            className="w-7 h-7 rounded border border-black/10 cursor-pointer p-0"
            title={`Custom ${label.toLowerCase()}`}
          />
          <span className="text-[11px] text-black/45">Custom hex</span>
        </div>
      )}
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

function PhoneIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

function MailIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

// Simple-icons WhatsApp glyph (filled). Rendered at 15px so its
// solid mass matches the visual weight of the 18px stroke-2 phone /
// mail glyphs in the same chip — without this it reads as visibly
// heavier and the row feels imbalanced.
function WhatsAppIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

// ─── Helpers ─────────────────────────────────────────────────────────────

// Operators sometimes paste/type "Phone: +255 …", "Email: hello@…",
// "WhatsApp: +255 …" into the value inputs even though the card
// already labels each field. The "Phone:" prefix then ends up
// embedded in tel:/mailto:/wa.me hrefs and breaks click-to-call /
// click-to-mail entirely. Strip a leading label-colon defensively so
// however the operator types it, the cards and links carry a clean
// value. Case-insensitive, whitespace-tolerant, idempotent.
function stripLabel(label: string, value: string | undefined): string | undefined {
  if (!value) return value;
  const re = new RegExp(`^\\s*${label}\\s*:\\s*`, "i");
  const cleaned = value.replace(re, "").trim();
  return cleaned || undefined;
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

// Pick a foreground colour given a background. Used so card title +
// value text stay legible whatever bg the operator picks (white card →
// charcoal text; charcoal card → cream text).
function textOn(bg: string, light: string, dark: string): string {
  const b = brightness(bg);
  return b > 140 ? light : dark;
}

function brightness(color: string): number {
  const t = color.trim();
  if (t.startsWith("#")) {
    const cleaned = t.slice(1);
    const full =
      cleaned.length === 3
        ? cleaned.split("").map((c) => c + c).join("")
        : cleaned.slice(0, 6);
    if (full.length !== 6) return 200;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return 200;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(t);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return 200;
}
