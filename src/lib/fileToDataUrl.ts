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
  // Defaults keep the compressed output near ~700KB regardless of input
  // size. The intake cap below is a memory safety rail — browsers on
  // low-end devices can OOM decoding massive source images — not a
  // platform limit: compressed blobs are ~700KB before they hit Supabase.
  const maxDimension = opts.maxDimension ?? 1200;
  const quality = opts.quality ?? 0.78;
  const maxBytes = opts.maxBytes ?? 30 * 1024 * 1024;
  // If the encoded data URL is larger than this we re-encode at lower
  // quality (and, if still too big, smaller dimensions). Caps a single
  // photo at ~700KB of base64.
  const TARGET_ENCODED_BYTES = 700 * 1024;

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
    let encoded = encodeAtSize(img, dim, q, outputType);
    for (let pass = 0; pass < 3 && encoded.length > TARGET_ENCODED_BYTES; pass++) {
      // First pass: drop quality. Subsequent passes: also shrink.
      if (outputType === "image/jpeg") q = Math.max(0.55, q - 0.1);
      if (pass > 0) dim = Math.max(800, Math.round(dim * 0.85));
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
