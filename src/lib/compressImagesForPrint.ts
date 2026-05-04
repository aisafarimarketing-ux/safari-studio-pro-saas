// ─── Print-time image compression ──────────────────────────────────────────
//
// Runs on /p/[id]/print before we flip window.__SS_READY__ = true (which
// is the signal the PDF renderer waits for). Walks every <img> in the
// DOM, and for any data-URL source whose encoded payload is over a
// threshold, re-encodes it through a canvas at a tighter JPEG quality
// and smaller max-dimension.
//
// Quality settings (April 2026 bump for print fidelity):
//   • 0.82 JPEG quality — visibly sharper than the previous 0.62 at
//     A4 viewing distance; still ~half the size of source images.
//   • 1800px long edge — A4 at 300dpi is 2480 × 3508 px, so 1800px on
//     the long edge gives ≥250 effective dpi for full-bleed images
//     and 300+ dpi for any image rendered at half-page or smaller.
//   • 0.5MB skip threshold — small UI thumbnails (avatars, logos)
//     stay untouched; bytes-saved math doesn't pay off below that.
//
// Bandwidth tradeoff: a 10-property proposal that previously came out
// to ~10–12MB now lands closer to 16–20MB. Acceptable for shareable
// PDFs; the alternative (soft images on luxury safari proposals)
// reads as low quality regardless of the rest of the design.
//
// Non-JPEG inputs (PNGs with transparency) get converted to JPEG
// anyway — nothing in a safari proposal needs alpha channels.

const TARGET_LONG_EDGE = 1800;
const TARGET_QUALITY = 0.82;
const MIN_COMPRESS_BYTES = 100_000; // skip thumbnails / icons

type CompressionResult = {
  processed: number;
  bytesBefore: number;
  bytesAfter: number;
};

export async function compressPrintImages(): Promise<CompressionResult> {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
  const result: CompressionResult = { processed: 0, bytesBefore: 0, bytesAfter: 0 };

  for (const img of imgs) {
    try {
      const src = img.src || img.getAttribute("src") || "";
      if (!src.startsWith("data:")) continue;

      // Skip cover-section images. The cover is the brand's first
      // impression on a luxury safari proposal — worth the few extra
      // MB to keep the operator's uploaded resolution and quality
      // intact. Identified by the section root's data-section-type
      // attribute, which CoverSection.tsx sets in every variant.
      if (img.closest('[data-section-type="cover"]')) continue;

      // Skip explicitly opted-out images. Operators / future code can
      // opt a specific image out of compression by tagging it with
      // data-no-compress (or its parent container with same attr).
      if (img.closest("[data-no-compress]")) continue;

      const before = approxDataUrlBytes(src);
      if (before < MIN_COMPRESS_BYTES) continue;

      await ensureDecoded(img);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) continue;

      const next = await reencode(img);
      if (!next) continue;

      const after = approxDataUrlBytes(next);
      // Only swap if the new version is meaningfully smaller — avoids
      // flipping an already-tiny PNG up to a slightly larger JPEG.
      if (after >= before * 0.9) continue;

      img.src = next;
      img.removeAttribute("srcset");
      result.processed += 1;
      result.bytesBefore += before;
      result.bytesAfter += after;
    } catch (err) {
      console.warn("[print-compress] skipped one image:", err);
    }
  }

  return result;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function approxDataUrlBytes(dataUrl: string): number {
  // data:image/xxx;base64,ABC...  — the payload is base64 after the comma.
  // Each base64 char is 6 bits → 4 chars ≈ 3 bytes. Good enough for
  // bucketing, not an exact byte count.
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return 0;
  const payloadChars = dataUrl.length - commaIdx - 1;
  return Math.round(payloadChars * 0.75);
}

function ensureDecoded(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

async function reencode(img: HTMLImageElement): Promise<string | null> {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (!srcW || !srcH) return null;

  // Scale the longer edge to TARGET_LONG_EDGE, preserving aspect ratio.
  const longEdge = Math.max(srcW, srcH);
  const scale = longEdge > TARGET_LONG_EDGE ? TARGET_LONG_EDGE / longEdge : 1;
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // White background for any PNG-to-JPEG conversion — transparent
  // pixels otherwise render black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  try {
    return canvas.toDataURL("image/jpeg", TARGET_QUALITY);
  } catch {
    return null;
  }
}
