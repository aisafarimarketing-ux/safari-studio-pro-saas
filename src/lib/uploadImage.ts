import { fileToOptimizedDataUrl } from "./fileToDataUrl";
import { authFetch } from "./authFetch";

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
    // authFetch retries transient 401s (Clerk JWT mid-refresh) with
    // exponential backoff so a single brief refresh window doesn't
    // surface as an upload failure to the operator.
    const res = await authFetch("/api/upload-image", {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      const data = (await res.json()) as { url?: string };
      if (data.url) return data.url;
    }
    // 401 only reaches us here AFTER authFetch has retried with
    // exponential backoff. So it's a real expired session, not a
    // transient mid-refresh. authFetch already dispatched the
    // auth-expired event; we just need to throw so the operator's
    // upload handler alerts them clearly. CRITICAL: do NOT silently
    // fall back to a data URL — operators reported "images missing in
    // preview" because data-URL uploads never persisted (auto-save
    // also 401'd, so the URL never reached the DB). 503 (storage
    // misconfigured) still falls back to data URL because that's a
    // server-config issue, not auth.
    if (res.status === 401) {
      throw new Error("Your session has expired — sign in again to save uploads.");
    }
    if (res.status === 402) {
      window.location.href = "/account-suspended";
      throw new Error("Account suspended");
    }
    if (res.status === 409) {
      window.location.href = "/select-organization";
      throw new Error("Select an organization to continue");
    }
    return dataUrl;
  } catch (err) {
    // Re-throw auth errors so the caller's try/catch surfaces them.
    if (err instanceof Error && /session has expired/i.test(err.message)) {
      throw err;
    }
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
