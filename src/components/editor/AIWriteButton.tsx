"use client";

import { useState } from "react";

// Small inline "Generate with AI" / "Rewrite with AI" button used by
// Greeting, Closing, CustomText. Hits /api/ai/rewrite in either "write"
// or "rewrite" mode with whatever context the caller provides, then
// returns the text to the parent through onResult.

type Tone = "warm" | "formal" | "brief" | "playful" | "poetic";
type Length = "shorter" | "same" | "longer";

export function AIWriteButton({
  kind,
  currentText,
  context,
  onResult,
  compact = false,
}: {
  /** A label shown in the prompt so the model knows the section role. */
  kind: "greeting" | "closing-signoff" | "closing-quote" | "custom";
  currentText: string;
  context?: Record<string, unknown>;
  onResult: (text: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone | "">("");
  const [length, setLength] = useState<Length>("same");

  const hasText = currentText.trim().length > 0;

  const run = async (mode: "write" | "rewrite") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text: hasText ? currentText : undefined,
          prompt: promptFor(kind),
          tone: tone || undefined,
          length: length || undefined,
          context: { ...context, sectionKind: kind },
        }),
      });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { text: string };
      onResult(data.text);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI call failed");
    } finally {
      setBusy(false);
    }
  };

  const label = hasText ? "Rewrite with AI" : "Write with AI";

  return (
    <div
      className="relative inline-block"
      data-editor-chrome
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition disabled:opacity-50 ${
          compact
            ? "px-2.5 py-1 text-[11.5px]"
            : "px-3 py-1.5 text-[12px]"
        }`}
        style={{
          color: "#1b3a2d",
          background: "rgba(27,58,45,0.06)",
          border: "1px solid rgba(27,58,45,0.18)",
        }}
      >
        <span style={{ color: "#c9a84c" }}>✦</span>
        <span>{busy ? "Working…" : label}</span>
      </button>

      {open && !busy && (
        <div
          className="absolute z-50 mt-1 right-0 top-full w-64 bg-white border border-black/10 rounded-xl shadow-xl p-3 ss-popover-in"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-2">Tone</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {(["", "warm", "formal", "brief", "playful", "poetic"] as const).map((t) => (
              <button
                key={t || "default"}
                type="button"
                onClick={() => setTone(t as Tone | "")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize transition ${
                  tone === t
                    ? "bg-[#1b3a2d] text-white"
                    : "text-black/65 hover:bg-black/[0.05] border border-black/10"
                }`}
              >
                {t || "default"}
              </button>
            ))}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-2">Length</div>
          <div className="flex gap-1 mb-4">
            {(["shorter", "same", "longer"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLength(l)}
                className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium capitalize transition ${
                  length === l
                    ? "bg-[#1b3a2d] text-white"
                    : "text-black/65 hover:bg-black/[0.05] border border-black/10"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {error && (
            <div className="mb-2 text-[11.5px] text-[#b34334]">{error}</div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2.5 py-1.5 text-[11.5px] rounded-md text-black/55 hover:bg-black/[0.04] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => run(hasText ? "rewrite" : "write")}
              className="ml-auto px-3 py-1.5 text-[11.5px] rounded-md bg-[#1b3a2d] text-white font-semibold hover:bg-[#2d5a40] transition"
            >
              {hasText ? "Rewrite" : "Write"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function promptFor(kind: string): string {
  switch (kind) {
    case "greeting":
      return "Write a 3-4 sentence opening greeting for a safari proposal, addressing the named guests directly.";
    case "closing-signoff":
      return "Write a warm 2-3 sentence sign-off from the consultant that feels personal and invites follow-up.";
    case "closing-quote":
      return "Write a single short, grounded line about safari travel — not a cliché, not a flourish. One sentence.";
    case "custom":
      return "Write a paragraph suitable for this proposal section.";
    default:
      return "Write a paragraph.";
  }
}
