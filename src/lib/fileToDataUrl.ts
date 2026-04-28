// Convert a File/Blob into a persistent data URL so it survives
// a page refresh / gets saved in the proposal JSON / travels to the
// /p/[id] share page. Downscales large images to keep the payload
// reasonable.
//
// Why not URL.createObjectURL? That returns a blob: URL scoped to
// the current document's lifetime — it cannot be serialized, saved,
// or opened in another browser.
//
// Upgrade path: replace with upload-to-storage (Supabase Storage / S3)
// when proposal JSON sizes start to bloat.

export async function fileToOptimizedDataUrl(
  file: File,
  opts: { maxDimension?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  // Defaults tuned for a premium proposal product:
  //   - 1920px max dimension = full HD; looks crisp on retina + clean
  //     at A4 print resolution
  //   - 0.85 JPEG quality = the "imperceptible loss" threshold used by
  //     NatGeo / Airbnb Plus / luxury travel sites
  //   - ~1.1MB cap per image = enough headroom for the higher quality
  //     setting while still bounded against runaway file sizes
  //
  // Older settings were 1200/0.78/700KB which looked visibly soft on
  // close inspection — fine for thumbnails, off-brand for a luxury
  // safari deck. The iterative-compression loop below still steps the
  // quality down if a particular image won't fit the cap, so the
  // worst-case file size is still bounded.
  const maxDimension = opts.maxDimension ?? 1920;
  const quality = opts.quality ?? 0.85;
  const maxBytes = opts.maxBytes ?? 30 * 1024 * 1024;
  // If the encoded data URL is larger than this we re-encode at lower
  // quality (and, if still too big, smaller dimensions). Caps a single
  // photo at ~1.1MB of base64.
  const TARGET_ENCODED_BYTES = 1100 * 1024;

  if (file.size > maxBytes) {
    throw new Error(`Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — max ${(maxBytes / 1024 / 1024).toFixed(0)}MB`);
  }

  // SVGs have no pixel dimensions to downscale — read them directly.
  if (file.type === "image/svg+xml") {
    return await readAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    let dim = maxDimension;
    let q = quality;
    // Preserve PNG transparency; everything else → JPEG for smaller size.
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

    // Encode once, then iteratively shrink/compress until we land under
    // the per-image budget. Three passes max — bails out with whatever
    // the smallest result is to avoid an infinite loop on weird inputs.
    // Quality floor 0.72 (was 0.55): better to ship a slightly larger
    // 0.72 image than a visibly soft 0.55 one for a luxury brand.
    // Dimension floor 1280px (was 800): keeps print-resolution viable
    // even on the worst-case oversized input.
    let encoded = encodeAtSize(img, dim, q, outputType);
    for (let pass = 0; pass < 3 && encoded.length > TARGET_ENCODED_BYTES; pass++) {
      if (outputType === "image/jpeg") q = Math.max(0.72, q - 0.06);
      if (pass > 0) dim = Math.max(1280, Math.round(dim * 0.9));
      encoded = encodeAtSize(img, dim, q, outputType);
    }
    return encoded;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function encodeAtSize(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
  outputType: "image/png" | "image/jpeg",
): string {
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(outputType, quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
