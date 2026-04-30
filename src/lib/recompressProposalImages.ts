import type { Proposal, Section } from "./types";

// One-shot utility that walks every image field in a proposal and re-encodes
// any oversized base64 data URL at the current (tighter) defaults. Intended
// for proposals created before we tightened fileToOptimizedDataUrl — those
// can easily exceed the platform's body-size cap and block autosave.
//
// Runs entirely in the browser (uses <img> + canvas). Sequential on purpose:
// parallel canvas decodes thrash memory on low-end devices and a typical
// proposal has ≤ 40 images.

// Re-compression target — only kicks in when an autosaved proposal is
// over the size guard. Bumped from 1200/0.78 to 1800/0.85: even after
// the size-guard recompression pass, images stay sharp on retina +
// print. Operators were calling out "pictures look soft" — this was
// a major contributor on proposals that had been autosaved past the
// guard threshold.
const TARGET_MAX_DIMENSION = 1800;
const TARGET_QUALITY = 0.85;
const TARGET_ENCODED_BYTES = 700 * 1024;

export type RecompressResult = {
  proposal: Proposal;
  beforeBytes: number;
  afterBytes: number;
  recompressedCount: number;
};

export async function recompressProposalImages(
  proposal: Proposal,
): Promise<RecompressResult> {
  const beforeBytes = JSON.stringify(proposal).length;
  let count = 0;

  // Helper that ensures we only recompress oversized dataURLs; small ones
  // (logos, etc.) pass through untouched.
  const recompress = async (url: string | null | undefined): Promise<string | null> => {
    if (!url || !isLargeDataUrl(url)) return url ?? null;
    try {
      const reencoded = await reencodeDataUrl(url);
      if (reencoded.length < url.length) {
        count++;
        return reencoded;
      }
      return url;
    } catch (err) {
      // If re-encoding fails for any reason (decoder error, memory), leave
      // the original in place rather than nulling out a real image.
      console.warn("[recompress] failed for one image:", err);
      return url;
    }
  };

  // ── Days ────────────────────────────────────────────────────────────────
  const days = await Promise.all(
    proposal.days.map(async (d) => {
      const heroImageUrl = await recompress(d.heroImageUrl);
      return heroImageUrl === d.heroImageUrl ? d : { ...d, heroImageUrl: heroImageUrl ?? undefined };
    }),
  );

  // ── Properties (lead + gallery) ─────────────────────────────────────────
  const properties = [];
  for (const p of proposal.properties) {
    const leadImageUrl = await recompress(p.leadImageUrl);
    const galleryUrls: string[] = [];
    let galleryChanged = false;
    for (const g of p.galleryUrls ?? []) {
      const next = await recompress(g);
      if (next !== g) galleryChanged = true;
      if (next) galleryUrls.push(next);
    }
    if (leadImageUrl === p.leadImageUrl && !galleryChanged) {
      properties.push(p);
    } else {
      properties.push({ ...p, leadImageUrl: leadImageUrl ?? undefined, galleryUrls });
    }
  }

  // ── Section content — walk any string value that looks like a dataURL ──
  const sections: Section[] = [];
  for (const s of proposal.sections) {
    const [content, changed] = await recompressRecord(s.content, recompress);
    sections.push(changed ? { ...s, content } : s);
  }

  // ── Operator logo, if present as a dataURL ──────────────────────────────
  const currentLogo = (proposal.operator as { logoUrl?: string }).logoUrl;
  const compressedLogo = await recompress(currentLogo);
  const operator =
    compressedLogo === currentLogo
      ? proposal.operator
      : { ...proposal.operator, logoUrl: compressedLogo ?? undefined };

  const next: Proposal = { ...proposal, days, properties, sections, operator };
  const afterBytes = JSON.stringify(next).length;
  return { proposal: next, beforeBytes, afterBytes, recompressedCount: count };
}

// ─── Internals ────────────────────────────────────────────────────────────

function isLargeDataUrl(url: string): boolean {
  if (!url.startsWith("data:image/")) return false;
  // Anything under ~120KB is already small enough that recompressing wastes
  // CPU and can even grow the output (e.g. PNG → JPEG round-trips).
  return url.length > 120 * 1024;
}

async function recompressRecord(
  record: Record<string, unknown>,
  recompress: (url: string) => Promise<string | null>,
): Promise<[Record<string, unknown>, boolean]> {
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string" && isLargeDataUrl(v)) {
      const next = (await recompress(v)) ?? v;
      if (next !== v) changed = true;
      out[k] = next;
    } else if (Array.isArray(v)) {
      const arr: unknown[] = [];
      let arrChanged = false;
      for (const item of v) {
        if (typeof item === "string" && isLargeDataUrl(item)) {
          const next = (await recompress(item)) ?? item;
          if (next !== item) arrChanged = true;
          arr.push(next);
        } else {
          arr.push(item);
        }
      }
      if (arrChanged) changed = true;
      out[k] = arr;
    } else {
      out[k] = v;
    }
  }
  return [out, changed];
}

async function reencodeDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const ratio = Math.min(1, TARGET_MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  // Prefer JPEG for re-encoding: the original images are photos, PNG
  // round-trips bloat them for no visible gain. Only preserve PNG when the
  // source is a PNG AND encoding JPEG would lose transparency.
  const outputType = dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";

  // New path: after canvas re-encode, try to upload the result to Supabase
  // Storage so existing proposals shed their inline base64. If the upload
  // endpoint isn't available (dev, offline, 503), we fall through to the
  // compressed data URL below. Defined as a nested helper so the upload
  // happens after compression but before we commit a return value.
  const canvasToUploadedUrl = async (q: number): Promise<string | null> => {
    return await new Promise<string | null>((resolve) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) return resolve(null);
          try {
            const form = new FormData();
            form.append(
              "file",
              new File([blob], `recompressed.${outputType === "image/png" ? "png" : "jpg"}`, {
                type: outputType,
              }),
            );
            const res = await fetch("/api/upload-image", { method: "POST", body: form });
            if (!res.ok) return resolve(null);
            const data = (await res.json()) as { url?: string };
            resolve(data.url ?? null);
          } catch {
            resolve(null);
          }
        },
        outputType,
        q,
      );
    });
  };

  // Iterative compression — mirror fileToOptimizedDataUrl's strategy.
  let q = TARGET_QUALITY;
  let dim = TARGET_MAX_DIMENSION;
  let encoded = canvas.toDataURL(outputType, q);
  for (let pass = 0; pass < 3 && encoded.length > TARGET_ENCODED_BYTES; pass++) {
    if (outputType === "image/jpeg") q = Math.max(0.55, q - 0.1);
    if (pass > 0) {
      dim = Math.max(800, Math.round(dim * 0.85));
      const r = Math.min(1, dim / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * r));
      canvas.height = Math.max(1, Math.round(img.height * r));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    encoded = canvas.toDataURL(outputType, q);
  }

  // Try to upload the final canvas state to Supabase Storage. If the
  // endpoint succeeds, return the public URL — best outcome: the
  // proposal drops a huge data URL for a ~200 byte URL. If not, fall
  // back to the compressed data URL we already computed.
  const uploaded = await canvasToUploadedUrl(q);
  if (uploaded) return uploaded;
  return encoded;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = src;
  });
}
