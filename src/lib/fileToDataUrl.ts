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
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.85;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;

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
    const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, w, h);

    // Preserve PNG transparency; everything else → JPEG for smaller size.
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    return canvas.toDataURL(outputType, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
