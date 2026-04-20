"use client";

import { uploadImage } from "@/lib/uploadImage";

// Reusable right-click handler for image slots. Spawns a throwaway file
// input, waits for a file, runs it through uploadImage (which compresses,
// uploads to Supabase Storage, and returns a public URL — or falls back
// to a data URL if Storage isn't configured).
//
// Usage:
//   const onContext = makeImageContextUpload((url) => updateDay(id, { heroImageUrl: url }), isEditor);
//   <div onContextMenu={onContext}>…</div>

export function makeImageContextUpload(
  onResult: (url: string) => void,
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
        const url = await uploadImage(file);
        onResult(url);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Image upload failed");
      }
    };
    input.click();
  };
}
