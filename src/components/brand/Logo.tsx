// ─── Safari Studio brand mark + wordmark ─────────────────────────────────
//
// Single source of truth for the logo across the app. Two surfaces:
//
//   <Logo variant="full" />   — wordmark + mark, used in the landing
//                                page nav, marketing footers, share
//                                view header
//   <Logo variant="mark" />   — square mark only, used in tight UI
//                                spaces (editor toolbar collapsed,
//                                browser tab fallback, email signatures)
//
// The actual SVGs live in /public so they can also be referenced
// directly from <link rel="icon" />, email templates, etc. without
// duplicating the markup.

import Image from "next/image";

type LogoProps = {
  variant?: "full" | "mark";
  /** Tailwind height class. Defaults to h-7 (28px). */
  className?: string;
  /** Override `alt` text — useful when the logo is decorative
   *  (heading already says the brand name). */
  alt?: string;
};

export function Logo({ variant = "full", className = "h-7", alt }: LogoProps) {
  const src = variant === "mark" ? "/logo-mark.svg" : "/logo.svg";
  // Aspect ratios — matches each SVG's viewBox so layout reserves
  // the right space before the image loads.
  const ratio = variant === "mark" ? 1 : 480 / 80;
  return (
    <Image
      src={src}
      alt={alt ?? "Safari Studio"}
      width={ratio * 28}
      height={28}
      priority
      className={className}
      style={{ width: "auto" }}
    />
  );
}
