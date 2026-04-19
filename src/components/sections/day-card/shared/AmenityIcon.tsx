"use client";

// Keyword → inline line-art icon map for amenity / highlight chips in the
// new day-card footer. Pure SVG (no external font), matches the editorial
// aesthetic of the reference design. Falls back to a neutral dot when no
// keyword matches — never shows nothing.

type Kind =
  | "sundowner"
  | "coffee"
  | "wildlife"
  | "water"
  | "migration"
  | "beach"
  | "pool"
  | "mountain"
  | "fire"
  | "bed"
  | "dining"
  | "dot";

const KIND_KEYWORDS: Array<[Kind, RegExp]> = [
  ["sundowner", /sundowner|drink|wine|champagne|cocktail/i],
  ["coffee", /coffee|plantation|tea|farm/i],
  ["migration", /migration|crossing|river cross/i],
  ["wildlife", /wildlife|big\s*five|predator|lion|leopard|elephant|rhino|cheetah|buffalo|game|safari\s*drive|tracking|birding/i],
  ["water", /river|stream|spring|snorkel|dive|lake|ocean/i],
  ["beach", /beach|sand|shore|coast|atoll|island|lagoon/i],
  ["pool", /pool|plunge|jacuzzi|hot\s*tub|spa/i],
  ["mountain", /mountain|highland|hill|escarpment|volcano|crater\s*rim/i],
  ["fire", /fire|boma|bonfire|campfire|sundowner\s*deck/i],
  ["bed", /suite|tent|villa|room|bedroom|bed/i],
  ["dining", /dining|meal|breakfast|dinner|boma|bush\s*meal|cuisine|chef/i],
];

export function detectAmenityKind(label: string): Kind {
  for (const [kind, re] of KIND_KEYWORDS) {
    if (re.test(label)) return kind;
  }
  return "dot";
}

export function AmenityIcon({
  label,
  size = 14,
  color,
}: {
  label: string;
  size?: number;
  color?: string;
}) {
  const kind = detectAmenityKind(label);
  const stroke = color ?? "currentColor";
  const s = size;

  // Each icon is drawn in a 20×20 viewbox for consistency.
  switch (kind) {
    case "sundowner":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          {/* Sun on horizon with a glass */}
          <circle cx="14" cy="8" r="3" stroke={stroke} strokeWidth="1.2" />
          <path d="M3 13h14" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7 15v2m-1-2h2" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "coffee":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M4 7h11v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z" stroke={stroke} strokeWidth="1.2" />
          <path d="M15 8h2a2 2 0 0 1 0 4h-2" stroke={stroke} strokeWidth="1.2" />
          <path d="M7 4c.5 1-.5 1.5 0 2.5M10 4c.5 1-.5 1.5 0 2.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "migration":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          {/* Three hoofprints moving right */}
          <path d="M3 13c.5-1.5 2-1.5 2.5 0" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8 11c.5-1.5 2-1.5 2.5 0" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M13 9c.5-1.5 2-1.5 2.5 0" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M4 6l2-1m10 6l2-1" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "wildlife":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          {/* Paw print */}
          <circle cx="10" cy="13" r="3.2" stroke={stroke} strokeWidth="1.2" />
          <ellipse cx="5.5" cy="9" rx="1.3" ry="1.7" stroke={stroke} strokeWidth="1.2" />
          <ellipse cx="10" cy="6.5" rx="1.3" ry="1.7" stroke={stroke} strokeWidth="1.2" />
          <ellipse cx="14.5" cy="9" rx="1.3" ry="1.7" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case "water":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M2 8c2 0 3-2 5-2s3 2 5 2 3-2 5-2" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M2 13c2 0 3-2 5-2s3 2 5 2 3-2 5-2" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "beach":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          {/* Palm + horizon */}
          <path d="M10 5v9" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M10 5c-2-1-4 0-5 2M10 5c2-1 4 0 5 2M10 5c-1-2-3-2-4-1M10 5c1-2 3-2 4-1" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M2 16h16" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "pool":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 14c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M6 11V6a1.5 1.5 0 0 1 3 0v5M11 11V6a1.5 1.5 0 0 1 3 0v5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "mountain":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M2 15l5-7 3 4 2-2 6 5H2Z" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case "fire":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 3c1 2 3 3 3 6a3 3 0 0 1-6 0c0-1 .5-1.5 1-2-.5 2 2 2 2-1 0-1-1-2 0-3Z" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M6 17h8" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "bed":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 14V8" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M3 11h14v3" stroke={stroke} strokeWidth="1.2" />
          <path d="M17 14V8" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <rect x="6" y="8" width="4" height="3" rx="0.6" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case "dining":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M6 3v7M9 3v3a2 2 0 0 1-1.5 2" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M14 3c-1 0-2 2-2 4s1 3 2 3v7" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="2.5" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
  }
}
