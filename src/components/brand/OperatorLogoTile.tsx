"use client";

import { useEffect, useRef, useState } from "react";

// ─── OperatorLogoTile ────────────────────────────────────────────────────
//
// Universal-safe logo treatment for the cover. Operators upload all kinds
// of logos — light, dark, with white backgrounds, with colored backgrounds,
// just-text wordmarks. Without containment, every variant of the cover
// would either lose visibility (light logo on cream hero) or look clipped
// (white-bg logo plonked on a photo).
//
// Solution: render the logo inside a small "paper tile" — a rounded
// rectangle with consistent padding and a tile colour chosen per logo:
//
//   - Default: cream tile (#f5e8d8 @ 92%) — works for the vast majority
//     of logos because most are designed for white/light backgrounds.
//   - Predominantly-light logos (avg brightness > 200/255): switch to a
//     charcoal tile (#1a1a1a @ 88%) so a white wordmark reads on it.
//   - companyName-only fallback (no logoUrl): render the name as a
//     small uppercase wordmark on the cream tile.
//
// Brightness detection runs once on mount, off the canvas, ~50ms per
// image. Result is cached in component state — no per-render cost.
//
// Sized for the cover; for smaller surfaces (toolbar, footer card) use
// /components/brand/Logo instead.

type Tone = "light" | "dark";

const TILE_LIGHT = "rgba(245, 232, 216, 0.92)"; // cream paper
const TILE_DARK = "rgba(26, 26, 26, 0.88)";      // charcoal frosted

export function OperatorLogoTile({
  logoUrl,
  companyName,
  className = "",
  /** Logo height inside the tile. Padding adds ~12px on each side. */
  logoHeight = 44,
  /** Force a tile tone, skipping brightness detection. Use when the
   *  operator has explicitly chosen a treatment in settings. */
  toneOverride,
}: {
  logoUrl?: string;
  companyName?: string;
  className?: string;
  logoHeight?: number;
  toneOverride?: Tone;
}) {
  const [autoTone, setAutoTone] = useState<Tone>("light");
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (toneOverride || !logoUrl) return;
    let cancelled = false;
    void detectLogoTone(logoUrl).then((tone) => {
      if (!cancelled) setAutoTone(tone);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl, toneOverride]);

  if (!logoUrl && !companyName) return null;

  const tone = toneOverride ?? autoTone;
  const tileBg = tone === "dark" ? TILE_DARK : TILE_LIGHT;
  const wordmarkColor = tone === "dark" ? "#f5e8d8" : "#1f3a3a";

  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={{
        background: tileBg,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
        // Subtle hairline matches the tone — adds editorial precision.
        border:
          tone === "dark"
            ? "1px solid rgba(245,232,216,0.10)"
            : "1px solid rgba(31,58,58,0.08)",
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={logoUrl}
          alt={companyName ?? "Operator logo"}
          style={{
            height: logoHeight,
            width: "auto",
            maxWidth: 220,
            objectFit: "contain",
            display: "block",
          }}
          // anonymous CORS so the canvas brightness sampler doesn't
          // taint the canvas on cross-origin Supabase URLs.
          crossOrigin="anonymous"
        />
      ) : (
        <span
          className="text-[12px] uppercase tracking-[0.28em] font-semibold whitespace-nowrap"
          style={{ color: wordmarkColor }}
        >
          {companyName}
        </span>
      )}
    </div>
  );
}

// ─── Brightness detection ───────────────────────────────────────────────
//
// Sample the image into a tiny 32×32 canvas, take the average RGB, drop
// the alpha-zero pixels (transparent pixels would skew the average).
// Anything above the BRIGHTNESS_CUTOFF is considered "light" and gets
// the dark tile.
//
// The canvas approach is bulletproof for any image format the browser
// can decode. Cross-origin URLs need crossOrigin="anonymous" + the
// server's CORS headers; if the canvas is tainted (CORS denied), we
// fall back to "light" (the safe default for most logos).

const BRIGHTNESS_CUTOFF = 200;

async function detectLogoTone(url: string): Promise<Tone> {
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    const SIZE = 32;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "light";
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 8) continue; // skip transparent pixels
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceptual luminance — better than raw average for "does this
      // read as light to a human eye?".
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }

    if (count === 0) return "light"; // entirely transparent — go safe
    const avg = total / count;
    return avg > BRIGHTNESS_CUTOFF ? "dark" : "light";
  } catch {
    // Canvas tainted by CORS, image failed to load, etc. The cream
    // tile is the safer default for the long tail of logos.
    return "light";
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load logo"));
    img.src = src;
  });
}
