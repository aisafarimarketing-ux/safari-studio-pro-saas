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
    // 401 = expired Clerk session. CRITICAL: do NOT silently fall back
    // to a data URL here. Operators reported "images not showing in
    // preview / webview" — the root cause was a chain of:
    //   (1) session expired
    //   (2) /api/upload-image 401 → silent data-URL fallback
    //   (3) /api/proposals/[id] auto-save 401 → save fails silently
    //   (4) on reload, proposal in DB is whatever was saved BEFORE the
    //       session expired, with the new image data URLs lost.
    // Throwing here surfaces the error in the editor's image upload
    // handler (which alerts) and signals the auth-watcher to prompt
    // the operator to re-sign-in BEFORE more changes silently
    // disappear. 503 (storage misconfigured) still falls back to
    // data URL because that's a server-config issue, not auth.
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("safari-studio:auth-expired"));
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
