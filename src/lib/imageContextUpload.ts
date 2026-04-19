"use client";

import { fileToOptimizedDataUrl } from "@/lib/fileToDataUrl";

// Reusable right-click handler for image slots. Spawns a throwaway file
// input, waits for a file, runs it through the existing optimisation
// pipeline, then hands back a data URL via onResult.
//
// Usage:
//   const onContext = makeImageContextUpload((dataUrl) => updateDay(id, { heroImageUrl: dataUrl }), isEditor);
//   <div onContextMenu={onContext}>…</div>

export function makeImageContextUpload(
  onResult: (dataUrl: string) => void,
  enabled = true,
): (e: React.MouseEvent) => void {
  return (e: React.MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToOptimizedDataUrl(file);
        onResult(dataUrl);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Image upload failed");
      }
    };
    input.click();
  };
}
