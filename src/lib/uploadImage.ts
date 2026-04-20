import { fileToOptimizedDataUrl } from "./fileToDataUrl";

// Two-stage upload helper.
//
// 1. Compresses the image on the client the same way fileToOptimizedDataUrl
//    does (capped dimension + JPEG quality + iterative re-encode), so the
//    file we ship to Supabase is already reasonable in size.
// 2. POSTs the compressed blob to /api/upload-image. On success returns
//    the public Supabase URL. On failure (503 = Storage not configured,
//    any network error, etc.) falls back to returning a data URL so the
//    editor keeps working in local dev without Supabase keys set.
//
// Call sites don't need to change their signature — they still receive a
// string URL; they just don't know or care whether it's a real URL or a
// data URL.

export async function uploadImage(
  file: File,
  opts: { maxDimension?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  // Compress first — this call already handles all the downscale logic.
  let dataUrl: string;
  try {
    dataUrl = await fileToOptimizedDataUrl(file, opts);
  } catch (err) {
    throw err instanceof Error ? err : new Error("Image processing failed");
  }

  // Turn the data URL back into a Blob for the multipart upload.
  const blob = dataUrlToBlob(dataUrl);
  const form = new FormData();
  const safeName = file.name.replace(/[^\w.-]/g, "_") || "image";
  form.append("file", blob, safeName);

  try {
    const res = await fetch("/api/upload-image", {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      const data = (await res.json()) as { url?: string };
      if (data.url) return data.url;
    }
    // 503 = Storage not configured on the server. 4xx / 5xx = treat as
    // transient and fall back to the data URL so the operator can keep
    // editing. The autosave size guard will surface oversized payloads.
    return dataUrl;
  } catch {
    return dataUrl;
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) return new Blob([dataUrl], { type: "application/octet-stream" });
  const mime = match[1] || "application/octet-stream";
  const isB64 = match[2] === ";base64";
  const payload = match[3] ?? "";
  if (isB64) {
    const bin = atob(payload);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}
