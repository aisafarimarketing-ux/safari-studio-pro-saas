// Browser-side background removal for operator logos.
//
// Wraps @imgly/background-removal with a dynamic import so the ~5MB
// WASM/ONNX bundle never touches the main client bundle — it's only
// downloaded the first time an operator clicks "Remove background"
// on the Brand DNA settings page, and is then cached forever by the
// browser. End-client share pages never load it.
//
// Returns a PNG data URL (preserves transparency) and a Blob for
// callers that want to push the cleaned image through the existing
// upload pipeline.

export type RemoveBgProgress = (loaded: number, total: number) => void;

export async function removeLogoBackground(
  source: Blob | string,
  onProgress?: RemoveBgProgress,
): Promise<{ dataUrl: string; blob: Blob }> {
  // Dynamic import keeps the heavy WASM bundle out of the main chunk.
  const { removeBackground } = await import("@imgly/background-removal");

  const blob = await removeBackground(source, {
    output: { format: "image/png", quality: 1 },
    progress: onProgress
      ? (_key, loaded, total) => onProgress(loaded, total)
      : undefined,
  });

  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, blob };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read cleaned image"));
    reader.readAsDataURL(blob);
  });
}
