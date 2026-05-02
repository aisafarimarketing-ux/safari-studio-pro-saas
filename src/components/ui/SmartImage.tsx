"use client";

import { useState } from "react";

// SmartImage — image element that walks an ORDERED fallback chain on
// load failures. Standard `<img>` silently shows nothing when its src
// is broken (404, expired Supabase URL, CORS issue, etc.); operators
// have flagged "images not showing in preview / webview" repeatedly,
// and the root cause was that the resolved URL was non-empty but the
// asset itself couldn't load. Empty-string fallback chains don't help
// here — the URL is valid-looking, it just doesn't resolve.
//
// Pass `srcs` as an ordered list (most-preferred first). On an
// `onError` from one src, the component advances to the next. When
// every src has been exhausted, the slot renders `fallback` instead.
//
// We track FAILED urls as a Set rather than an idx — that way the
// candidate list can change between renders (parent passes a new
// array) without us needing a reset effect, and we still skip URLs
// that have already failed in this lifetime of the component.

export function SmartImage({
  srcs,
  alt = "",
  className,
  style,
  fallback,
  loading = "eager",
}: {
  srcs: Array<string | null | undefined>;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Rendered when every src failed (or the list is empty). */
  fallback?: React.ReactNode;
  loading?: "eager" | "lazy";
}) {
  // Normalise: trim and drop empty / null / undefined entries up-front.
  // We don't want to "advance through" an empty string — we want a
  // clean ordered list of candidate URLs.
  const candidates = (srcs ?? [])
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  // First candidate that hasn't failed yet, in priority order.
  const current = candidates.find((c) => !failed.has(c));

  if (!current) {
    return <>{fallback ?? null}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current}
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={() => {
        setFailed((prev) => {
          if (prev.has(current)) return prev;
          const next = new Set(prev);
          next.add(current);
          return next;
        });
      }}
    />
  );
}
