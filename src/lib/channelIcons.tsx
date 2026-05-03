// Channel icons — used everywhere a deal action references WhatsApp /
// Email. The spec calls these "MANDATORY UI CLARITY": the operator
// must know at a glance where a message is going. Single source of
// truth so the WhatsApp green never drifts and the envelope stays
// visually distinct from the (green) WhatsApp glyph.
//
// Usage:
//   <WhatsAppIcon size={14} />
//   <EmailIcon size={14} muted />
//
// Both render as inline SVGs with currentColor where possible so the
// surrounding text colour cascades naturally for hover / disabled
// states. WhatsApp keeps the brand green by default so it stays
// instantly recognisable; pass `mono` to flatten to currentColor when
// the chip background is already brand-coloured.

import * as React from "react";

export const WHATSAPP_GREEN = "#25D366";
export const WHATSAPP_GREEN_DARK = "#128C7E";

export function WhatsAppIcon({
  size = 14,
  mono = false,
  className,
}: {
  size?: number;
  /** When true, paints with currentColor instead of the brand green —
   *  use this on chip backgrounds that are already green. */
  mono?: boolean;
  className?: string;
}) {
  const fill = mono ? "currentColor" : WHATSAPP_GREEN;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="WhatsApp"
      className={className}
    >
      <path
        fill={fill}
        d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.554-5.338 11.89-11.893 11.89a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.595 5.392l.323.514-1 3.654 3.79-.989.781.730z"
      />
      <path
        fill="#fff"
        d="M9.067 7.456c-.213-.474-.437-.484-.64-.493l-.545-.007a1.045 1.045 0 0 0-.758.355c-.262.288-1 .978-1 2.385s1.024 2.769 1.166 2.96c.142.19 1.974 3.157 4.86 4.305 2.398.952 2.886.762 3.405.715.521-.047 1.674-.685 1.91-1.346.236-.661.236-1.227.165-1.345-.07-.118-.262-.19-.547-.332-.286-.142-1.69-.834-1.95-.929-.262-.095-.452-.142-.642.142-.19.284-.736.929-.902 1.119-.166.19-.332.213-.617.071-.286-.142-1.207-.445-2.299-1.418-.85-.756-1.422-1.689-1.59-1.974-.166-.284-.018-.439.124-.581.128-.127.286-.332.428-.499.142-.166.19-.284.286-.474.094-.19.047-.355-.024-.498-.07-.142-.626-1.553-.88-2.118z"
      />
    </svg>
  );
}

export function EmailIcon({
  size = 14,
  muted = false,
  className,
}: {
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  const stroke = muted ? "rgba(10,20,17,0.55)" : "currentColor";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Email"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3,7 12,13 21,7" />
    </svg>
  );
}

// One-line "Sent via X" indicator with the right icon. Used after the
// operator dispatches and after auto-send completes.
export function ChannelSentLabel({
  channel,
  size = 13,
}: {
  channel: "whatsapp" | "email";
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: size }}>
      {channel === "whatsapp" ? (
        <WhatsAppIcon size={size} />
      ) : (
        <EmailIcon size={size} muted />
      )}
      <span style={{ fontWeight: 600, color: "rgba(10,20,17,0.75)" }}>
        Sent via {channel === "whatsapp" ? "WhatsApp" : "Email"}
      </span>
    </span>
  );
}
