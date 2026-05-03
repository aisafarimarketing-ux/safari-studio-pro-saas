"use client";

import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/lib/uploadImage";

// Canvas-backed signature pad. Draw with a mouse or finger, then save.
// The last signature is cached in localStorage under a single key so a
// consultant drafting multiple proposals doesn't have to re-sign every
// time — on re-open the pad preloads the most recent one.
//
// Also exposes an upload fallback for anyone who prefers a scanned PNG.

const STORAGE_KEY = "ss:lastSignature";

export function SignaturePad({
  initial,
  onSave,
  onClose,
}: {
  /** Seed the pad with the operator's current signature (if any). */
  initial?: string | null;
  /** Called with the PNG data URL of the signed image. */
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [lastRemembered, setLastRemembered] = useState<string | null>(null);

  // Resize + prime the canvas once mounted. DPR-aware so the stroke stays
  // crisp on retina screens. Canvas stays *transparent* — the previous
  // white fillRect baked a white background into every exported PNG,
  // which then surfaced on dark headers / tinted footers as an
  // out-of-place rectangle. Going transparent + auto-cropping on save
  // is the fix.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssW = 380;
    const cssH = 140;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#1b2125";

    // If we have an initial signature, paint it in.
    if (initial) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssW, cssH);
        setIsEmpty(false);
      };
      img.src = initial;
    }

    // Load the last-remembered signature for the "Use previous" affordance.
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setLastRemembered(stored);
    } catch {
      // localStorage may be disabled (private mode, SSR guard) — silent fallback.
    }
  }, [initial]);

  const pointFromEvent = (e: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsEmpty(false);
  };

  const extendStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    const canvas = canvasRef.current;
    try {
      canvas?.releasePointerCapture(e.pointerId);
    } catch {
      // Some browsers throw if capture wasn't taken — safe to swallow.
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    // Transparent clear — clearRect zeroes the alpha channel so the
    // canvas reads as the underlying CSS background, not an opaque
    // white rectangle.
    ctx.clearRect(0, 0, width, height);
    setIsEmpty(true);
  };

  const loadPrevious = () => {
    if (!lastRemembered) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      setIsEmpty(false);
    };
    img.src = lastRemembered;
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    // Auto-crop to the bounding box of the drawn ink, with a small
    // padding margin. Saves a tight transparent PNG — the previous
    // 380×140 frame ballooned the visible signature on every render
    // surface (footer, share view, PDF). Falls back to the full
    // canvas when crop detection finds nothing (degenerate case).
    const cropped = exportCroppedSignature(canvas);
    const dataUrl = cropped ?? canvas.toDataURL("image/png");
    try {
      window.localStorage.setItem(STORAGE_KEY, dataUrl);
    } catch {
      // If we can't cache it that's fine — it's still saved to the proposal.
    }
    onSave(dataUrl);
    onClose();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await uploadImage(file, { maxDimension: 800, quality: 0.9 });
      try {
        window.localStorage.setItem(STORAGE_KEY, dataUrl);
      } catch {
        // localStorage unavailable — save-to-proposal still works.
      }
      onSave(dataUrl);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: "rgba(20,20,20,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 flex items-baseline justify-between border-b border-black/5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-black/55">
              Signature
            </div>
            <div className="text-[18px] font-semibold text-black/85 mt-0.5">
              Sign above the line
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-black/55 hover:text-black/85 transition"
          >
            Cancel
          </button>
        </div>

        <div className="p-6">
          <div className="relative mx-auto" style={{ width: 380, height: 140 }}>
            <canvas
              ref={canvasRef}
              onPointerDown={startStroke}
              onPointerMove={extendStroke}
              onPointerUp={endStroke}
              onPointerLeave={endStroke}
              className="touch-none border border-black/10 rounded-md bg-white cursor-crosshair"
              style={{ width: 380, height: 140 }}
            />
            <div
              className="absolute left-4 right-4 pointer-events-none"
              style={{ bottom: 22, borderBottom: "1px dashed rgba(0,0,0,0.18)" }}
            />
          </div>

          <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clear}
                className="text-[12.5px] font-medium px-3 py-1.5 rounded-md border border-black/12 text-black/70 hover:bg-black/5 transition"
              >
                Clear
              </button>
              {lastRemembered && (
                <button
                  type="button"
                  onClick={loadPrevious}
                  className="text-[12.5px] font-medium px-3 py-1.5 rounded-md border border-black/12 text-black/70 hover:bg-black/5 transition"
                >
                  Use last signature
                </button>
              )}
              <label className="text-[12.5px] font-medium px-3 py-1.5 rounded-md border border-black/12 text-black/70 hover:bg-black/5 transition cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                Upload image
              </label>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={isEmpty}
              className="text-[13px] font-semibold px-4 py-2 rounded-md transition"
              style={{
                background: isEmpty ? "#c8c8c8" : "#1b3a2d",
                color: "white",
                cursor: isEmpty ? "not-allowed" : "pointer",
              }}
            >
              Save signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Find the bounding box of opaque pixels and export only that region
// as a PNG with a small padding margin. Returns null when the canvas
// is empty (no opaque pixels) so the caller falls back to the raw
// canvas — that path is dead in practice (we already gate on isEmpty)
// but it keeps the helper safe to call.
function exportCroppedSignature(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // canvas.width / .height are the DPR-scaled backing-store dimensions.
  // Scan the alpha channel to find the ink box, then export at 1:1
  // backing-store resolution so the ink stays crisp at large sizes.
  const w = canvas.width;
  const h = canvas.height;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch {
    // Cross-origin tainted canvas would throw; not possible here, but
    // returning null is the safe fallback either way.
    return null;
  }
  const data = imageData.data;
  // 4 bytes per pixel (RGBA). We only care whether alpha is non-zero —
  // opacity threshold of 8 ignores anti-aliasing fringes that visually
  // read as empty.
  const ALPHA_THRESHOLD = 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return null;

  // Padding scales with DPR so the visual margin stays consistent
  // across screens.
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const pad = Math.round(8 * dpr);
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  outCtx.putImageData(
    ctx.getImageData(cropX, cropY, cropW, cropH),
    0,
    0,
  );
  return out.toDataURL("image/png");
}
