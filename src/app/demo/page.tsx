"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { buildBlankProposal } from "@/lib/defaults";
import { mergeAutopilotIntoProposal, type AutopilotResult } from "@/lib/autopilotMerge";
import { ProposalCanvas } from "@/components/editor/ProposalCanvas";
import { STARTER_LIBRARY } from "@/lib/starterLibrary";
import { lookupDemoCoord } from "@/lib/demoDestinationCoords";
import { nanoid } from "@/lib/nanoid";
import { uploadImage } from "@/lib/uploadImage";
import type { Day, Property, Section, TierKey } from "@/lib/types";
import type { RouteCoord } from "@/components/sections/RouteMap";

// ─── Public demo page ──────────────────────────────────────────────────────
//
// Zero-auth landing-page demo. A prospect pastes a client enquiry email and
// watches Claude draft a complete personalised proposal in under a minute.
// Backed by /api/public/demo-autopilot.
//
// Two operator affordances that lift the demo above generic:
//   1. Drop their own brand photos into the uploader — cover + day heroes +
//      property carousels all use them instead of starter stock.
//   2. A hummingbird that flies a progress bar while Claude drafts — gives
//      the 15-30s render a calm, on-brand loading moment.
//
// No persistence. No account. Reload = fresh demo.

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";
const BONE = "#f8f5ef";

const SAMPLE_ENQUIRY = `Hi there,

We're starting to plan a honeymoon safari for late September / early October this year. Just the two of us — coming in from the UK. We'd love a mix of the Maasai Mara and somewhere a bit quieter, maybe Samburu, then finish with a couple of nights on Zanzibar to unwind. About 10 nights total.

Looking for something special but we're not chasing the absolute top end — we want camps with real character over polished resorts. Any ideas welcome.

Thanks,
Sarah & James`;

const DEMO_STAGES = [
  "Reading the enquiry…",
  "Matching guests with camps…",
  "Drafting the welcome letter…",
  "Writing each day…",
  "Setting the pricing tiers…",
  "Polishing the closing note…",
  "Almost there…",
];

// Max user-uploaded demo images. More than this adds clutter without helping
// the proposal output; they can be edited once the operator signs up.
const MAX_USER_IMAGES = 12;

type ViewState =
  | { kind: "idle" }
  | { kind: "drafting" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export default function DemoPage() {
  const [enquiry, setEnquiry] = useState("");
  const [view, setView] = useState<ViewState>({ kind: "idle" });
  const [userImages, setUserImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Fake-progress animation. Claude doesn't stream usable progress back,
  // so we animate 0 → 85% on a time curve that mirrors the typical draft
  // duration. When the response lands we snap to 100% and transition.
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pin the editor into preview mode so ProposalCanvas renders without
  // any editor chrome (hover bars, AI write buttons, section outlines).
  useEffect(() => {
    const prev = useEditorStore.getState().mode;
    useEditorStore.getState().setMode("preview");
    return () => {
      useEditorStore.getState().setMode(prev);
    };
  }, []);

  // Drive the progress bar + staged copy while drafting.
  useEffect(() => {
    if (view.kind !== "drafting") {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }
    setProgress(0);
    setStageIndex(0);
    const startedAt = Date.now();
    // Target: ~25s to reach 85%. Eased so early progress feels quick and
    // the bird slows as it approaches the end — perceived-speed trick.
    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      // easeOutExpo from 0 to ~85 over 25 seconds
      const t = Math.min(1, elapsed / 25);
      const eased = 1 - Math.pow(2, -6 * t);
      const pct = Math.min(85, Math.round(eased * 85));
      setProgress(pct);
      // Tie stage copy to pct — reads like real work happening
      const stage = Math.min(DEMO_STAGES.length - 1, Math.floor(pct / (85 / DEMO_STAGES.length)));
      setStageIndex(stage);
    }, 120);
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [view.kind]);

  const handleDraft = async () => {
    const text = enquiry.trim();
    if (text.length < 20) {
      setView({ kind: "error", message: "Paste a client enquiry — at least a sentence or two." });
      return;
    }
    setView({ kind: "drafting" });
    try {
      const res = await fetch("/api/public/demo-autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiry: text }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setView({
          kind: "error",
          message: data?.error ?? "You've hit the demo limit. Sign up for a free account to keep drafting.",
        });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setView({ kind: "error", message: data?.error ?? "The demo drafter hit an error. Please retry." });
        return;
      }
      const data = (await res.json()) as { trip: DemoTrip; draft: DemoDraft };
      // Snap progress to 100% for the satisfying finish before we swap views
      setProgress(100);
      setStageIndex(DEMO_STAGES.length - 1);
      hydrateDemoProposal(data.trip, data.draft, userImages);
      // Small pause so the 100% lands visually before the canvas swaps in
      await new Promise((r) => setTimeout(r, 450));
      setView({ kind: "ready" });
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
    } catch (err) {
      setView({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error — please retry.",
      });
    }
  };

  const handleAddImages = async (files: FileList | File[]) => {
    const pending = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_USER_IMAGES - userImages.length);
    if (pending.length === 0) return;
    setUploading(true);
    try {
      const dataUrls: string[] = [];
      for (const file of pending) {
        try {
          const url = await uploadImage(file, { maxDimension: 1600, quality: 0.82 });
          dataUrls.push(url);
        } catch (err) {
          console.warn("[DEMO] image rejected:", err);
        }
      }
      if (dataUrls.length > 0) {
        setUserImages((prev) => [...prev, ...dataUrls].slice(0, MAX_USER_IMAGES));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setUserImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setView({ kind: "idle" });
    setEnquiry("");
    setUserImages([]);
    setProgress(0);
    setStageIndex(0);
  };

  return (
    <div className="min-h-screen" style={{ background: BONE }}>
      {view.kind !== "ready" && (
        <DemoIntro
          enquiry={enquiry}
          setEnquiry={setEnquiry}
          view={view}
          onDraft={handleDraft}
          userImages={userImages}
          uploading={uploading}
          onAddImages={handleAddImages}
          onRemoveImage={handleRemoveImage}
          progress={progress}
          stage={DEMO_STAGES[stageIndex] ?? DEMO_STAGES[0]}
        />
      )}

      {view.kind === "ready" && <DemoResult onReset={handleReset} />}
    </div>
  );
}

// ─── Intro (textarea + image uploader + progress loader) ──────────────────

function DemoIntro({
  enquiry,
  setEnquiry,
  view,
  onDraft,
  userImages,
  uploading,
  onAddImages,
  onRemoveImage,
  progress,
  stage,
}: {
  enquiry: string;
  setEnquiry: (v: string) => void;
  view: ViewState;
  onDraft: () => void;
  userImages: string[];
  uploading: boolean;
  onAddImages: (files: FileList | File[]) => void;
  onRemoveImage: (idx: number) => void;
  progress: number;
  stage: string;
}) {
  const drafting = view.kind === "drafting";
  const errorMsg = view.kind === "error" ? view.message : null;

  return (
    <>
      <Nav />
      <section
        className="relative overflow-hidden pt-16"
        style={{ background: FOREST }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
          <div
            className="inline-block text-[11px] uppercase tracking-[0.24em] font-semibold"
            style={{ color: GOLD }}
          >
            Live demo — no signup
          </div>
          <h1
            className="mt-5 text-4xl md:text-5xl font-bold text-white leading-[1.08] tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Paste a client enquiry.
            <br />
            Watch a full proposal draft
            <em className="not-italic" style={{ color: GOLD }}> in under a minute.</em>
          </h1>
          <p className="mt-5 text-[15px] md:text-[16px] text-white/65 max-w-xl mx-auto leading-relaxed">
            Claude reads the email, picks camps, and writes every section.
            Drop in your own photos below and the draft wears your brand.
          </p>
        </div>
      </section>

      <section
        className="relative"
        style={{ background: `linear-gradient(to bottom, ${FOREST} 0%, ${FOREST} 40%, ${BONE} 40%, ${BONE} 100%)` }}
      >
        <div className="max-w-3xl mx-auto px-6 pb-16">
          <div
            className="rounded-2xl bg-white border shadow-xl overflow-hidden"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            <ImageUploader
              images={userImages}
              uploading={uploading}
              drafting={drafting}
              onAddImages={onAddImages}
              onRemove={onRemoveImage}
            />

            <div
              className="px-5 py-3 border-b border-t text-[12px] font-semibold tracking-wider uppercase"
              style={{ borderColor: "rgba(0,0,0,0.06)", color: FOREST, background: "rgba(201,168,76,0.08)" }}
            >
              The enquiry
            </div>
            <textarea
              value={enquiry}
              onChange={(e) => setEnquiry(e.target.value)}
              disabled={drafting}
              placeholder="Paste the email your client sent you — names, dates, destinations, anything they mentioned. Sarah & James, UK honeymoon, 10 nights Mara + Samburu + Zanzibar…"
              rows={9}
              className="block w-full px-5 py-4 text-[15px] leading-relaxed text-black/85 outline-none resize-none placeholder:text-black/35 disabled:bg-black/[0.02]"
              maxLength={4000}
            />
            <div
              className="px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3"
              style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.015)" }}
            >
              <button
                type="button"
                onClick={() => setEnquiry(SAMPLE_ENQUIRY)}
                disabled={drafting}
                className="text-[13px] font-medium text-black/55 hover:text-black/80 transition disabled:opacity-50"
              >
                Use a sample enquiry →
              </button>
              <div className="text-[12px] text-black/40 tabular-nums">
                {enquiry.length} / 4000
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl px-4 py-3 text-[13.5px] text-[#7a2e23] bg-[#f4d7d0] border border-[#e3b5ac]">
              {errorMsg}
            </div>
          )}

          {drafting ? (
            <div className="mt-8">
              <HummingbirdLoader progress={progress} stage={stage} />
            </div>
          ) : (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onDraft}
                disabled={enquiry.trim().length < 20}
                className="relative w-full sm:w-auto px-8 py-3.5 rounded-xl text-[15px] font-semibold transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: GOLD, color: FOREST }}
              >
                Draft my proposal →
              </button>
              <Link
                href="/pricing"
                className="text-[13.5px] text-black/55 hover:text-black/85 transition px-3 py-2"
              >
                or see pricing
              </Link>
            </div>
          )}

          {!drafting && <ValueStrip />}
        </div>
      </section>

      <Footer />
    </>
  );
}

// ─── Image uploader (drag-drop / paste / file-picker) ──────────────────────

function ImageUploader({
  images,
  uploading,
  drafting,
  onAddImages,
  onRemove,
}: {
  images: string[];
  uploading: boolean;
  drafting: boolean;
  onAddImages: (files: FileList | File[]) => void;
  onRemove: (idx: number) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const atCap = images.length >= MAX_USER_IMAGES;

  return (
    <div
      className="p-5 space-y-3"
      style={{ background: "rgba(27,58,45,0.025)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold tracking-wider uppercase" style={{ color: FOREST }}>
            Your photos <span className="text-black/40 normal-case font-normal tracking-normal text-[11.5px]">· optional</span>
          </div>
          <div className="text-[12px] text-black/50 mt-0.5">
            Drop lodge + destination photos — the draft will wear your brand instead of generic stock.
          </div>
        </div>
        {images.length > 0 && (
          <div className="text-[11px] text-black/40 tabular-nums shrink-0">
            {images.length} / {MAX_USER_IMAGES}
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {images.map((src, i) => (
            <div
              key={`${i}-${src.slice(0, 24)}`}
              className="relative aspect-[4/3] rounded-md overflow-hidden border bg-black/5 group"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                disabled={drafting}
                aria-label="Remove image"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] leading-none opacity-0 group-hover:opacity-100 hover:bg-black/80 transition disabled:hidden"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!atCap && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !drafting && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !drafting) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!drafting) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (drafting) return;
            if (e.dataTransfer.files?.length) onAddImages(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition ${
            dragOver
              ? "bg-[rgba(201,168,76,0.1)] border-[#c9a84c]"
              : "bg-white border-black/10 hover:border-black/25"
          } ${drafting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="text-[13px] text-black/60">
            {uploading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-black/20 border-t-[#1b3a2d] animate-spin" />
                Processing…
              </span>
            ) : (
              <>
                <span className="font-medium text-black/75">Drop photos here</span>
                <span className="text-black/40"> · or click to choose</span>
              </>
            )}
          </div>
          <div className="mt-1 text-[11px] text-black/40">
            JPG / PNG / WebP · up to {MAX_USER_IMAGES} · resized for you
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAddImages(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

// ─── Hummingbird loader ────────────────────────────────────────────────────
//
// Hand-drawn SVG bird that flies along a progress rail. Wings flap via CSS
// keyframes. The bird sits on top of the progress-fill edge so it visually
// "pulls" the fill across the track. Branded loading moment that costs us
// 150 lines and buys the whole perceived-speed impression.

function HummingbirdLoader({ progress, stage }: { progress: number; stage: string }) {
  // Clamp for safety — state could momentarily be < 0 or > 100
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="mx-auto max-w-xl">
      <div className="relative h-14">
        {/* Rail */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{ background: "rgba(27,58,45,0.12)" }}
          aria-hidden
        />
        {/* Fill */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${FOREST}, ${GOLD})`,
            boxShadow: `0 0 10px ${GOLD}66`,
          }}
          aria-hidden
        />
        {/* Bird — position uses left:% with a translate so it sits centred on the fill edge */}
        <div
          className="absolute top-1/2 hummingbird-fly"
          style={{
            left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            transition: "left 500ms ease-out",
          }}
          aria-hidden
        >
          <HummingbirdSVG />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12.5px]">
        <div className="text-black/60 font-medium">{stage}</div>
        <div className="tabular-nums font-semibold" style={{ color: FOREST }}>
          {pct}%
        </div>
      </div>

      <div className="mt-2 text-center text-[11.5px] text-black/40">
        Usually done in 15 – 30 seconds
      </div>

      <style jsx>{`
        @keyframes wings {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.15); }
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        :global(.hummingbird-fly) {
          animation: bob 0.9s ease-in-out infinite;
        }
        :global(.hummingbird-wing) {
          transform-origin: 22px 20px;
          animation: wings 0.14s linear infinite;
        }
      `}</style>
    </div>
  );
}

function HummingbirdSVG() {
  // Stylised hummingbird — body + head + beak + fanned tail + flapping wing.
  // Designed at 42×28; colours use the brand palette.
  return (
    <svg
      width="42"
      height="28"
      viewBox="0 0 42 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 2px 3px rgba(27,58,45,0.25))` }}
    >
      {/* Tail — fanned, forest-green */}
      <path
        d="M4 14 L0 10 L1 14 L0 18 Z"
        fill={FOREST}
      />
      {/* Body */}
      <path
        d="M4 14 C 10 9, 18 10, 24 13 C 26 14, 26 15, 24 16 C 18 18, 10 18, 4 14 Z"
        fill={FOREST}
      />
      {/* Head */}
      <circle cx="25" cy="13" r="3.5" fill={FOREST} />
      {/* Eye */}
      <circle cx="26" cy="12.5" r="0.7" fill="white" />
      {/* Beak — long slender, gold */}
      <path
        d="M28 13 L41 13.3 L28 14 Z"
        fill={GOLD}
      />
      {/* Iridescent throat patch */}
      <path
        d="M22 14.5 C 24 15.5, 25 15.3, 25 14 C 24 13.6, 22 13.8, 22 14.5 Z"
        fill={GOLD}
        opacity="0.7"
      />
      {/* Wing — ellipse that flaps via scaleY */}
      <g className="hummingbird-wing">
        <ellipse
          cx="16"
          cy="10"
          rx="9"
          ry="6"
          fill={FOREST}
          opacity="0.55"
        />
      </g>
    </svg>
  );
}

// ─── Result (rendered proposal + fixed CTA bar) ────────────────────────────

function DemoResult({ onReset }: { onReset: () => void }) {
  return (
    <>
      <div
        className="sticky top-0 z-40 backdrop-blur border-b flex items-center justify-between gap-3 px-4 py-2.5"
        style={{
          background: "rgba(27,58,45,0.96)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 text-[10px] uppercase tracking-[0.22em] font-bold px-2 py-1 rounded"
            style={{ background: GOLD, color: FOREST }}
          >
            Demo
          </div>
          <span className="text-white/80 text-[13px] truncate hidden sm:inline">
            This is a real Safari Studio proposal. Sign up to edit, brand, and send.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onReset}
            className="text-[13px] text-white/60 hover:text-white transition px-3 py-1.5"
          >
            ← Try another
          </button>
          <Link
            href="/sign-up"
            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            Sign up — free trial
          </Link>
        </div>
      </div>

      <div className="proposal-canvas">
        <ProposalCanvas />
      </div>

      {/* Closing CTA */}
      <section className="py-16 px-6" style={{ background: FOREST_DEEP }}>
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="inline-block text-[11px] uppercase tracking-[0.24em] font-semibold"
            style={{ color: GOLD }}
          >
            What just happened
          </div>
          <h2
            className="mt-4 text-3xl md:text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            That&apos;s your{" "}
            <em className="not-italic" style={{ color: GOLD }}>first proposal</em>.
            <br />
            There&apos;s a lot more.
          </h2>
          <p className="mt-5 text-white/60 max-w-xl mx-auto text-[15px] leading-relaxed">
            Add your own camps, apply your Brand DNA, send with a click, track what your clients read.
            Consultant tier starts at $29/month — close one safari and it pays for the year.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:brightness-110 active:scale-95"
              style={{ background: GOLD, color: FOREST }}
            >
              Open Studio — free trial
            </Link>
            <Link
              href="/pricing"
              className="px-5 py-3 rounded-xl text-[14px] text-white/75 hover:text-white transition border border-white/15"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Trust strip ───────────────────────────────────────────────────────────

function ValueStrip() {
  return (
    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px] text-black/60">
      <TrustItem symbol="◇" label="Your data stays yours" body="Nothing is saved. Refresh to start over." />
      <TrustItem symbol="◐" label="Real proposal output" body="Same canvas our paying operators ship." />
      <TrustItem symbol="◈" label="Real Claude AI" body="Every sentence written for these guests." />
    </div>
  );
}

function TrustItem({ symbol, label, body }: { symbol: string; label: string; body: string }) {
  return (
    <div className="rounded-xl bg-white border p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none" style={{ color: FOREST }}>{symbol}</div>
        <div>
          <div className="font-semibold text-black/80 text-[13.5px]">{label}</div>
          <div className="mt-0.5 text-black/55 leading-relaxed">{body}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Nav / Footer (mirror the pricing page) ────────────────────────────────

function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
      style={{ background: "rgba(27,58,45,0.94)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base"
            style={{ background: "rgba(201,168,76,0.18)", color: GOLD }}
          >
            S
          </div>
          <span className="text-white font-semibold text-[16px] tracking-tight">
            Safari Studio
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <Link href="/#how" className="hover:text-white transition">How it works</Link>
          <Link href="/demo" className="text-white">Demo</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden sm:inline-block px-3 py-1.5 text-sm text-white/70 hover:text-white transition"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 rounded-lg text-[14px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            Open Studio
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer
      className="py-10 border-t"
      style={{ background: FOREST_DEEP, borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-white/40">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center font-bold text-sm"
            style={{ background: "rgba(201,168,76,0.15)", color: GOLD }}
          >
            S
          </div>
          <span className="text-white/55 font-medium">Safari Studio</span>
        </div>
        <div className="flex gap-6">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <Link href="/demo" className="hover:text-white/70 transition">Demo</Link>
          <Link href="/pricing" className="hover:text-white/70 transition">Pricing</Link>
          <Link href="/sign-up" className="hover:text-white/70 transition">Open Studio</Link>
        </div>
        <div>&copy; {new Date().getFullYear()} Safari Studio · Nairobi</div>
      </div>
    </footer>
  );
}

// ─── Proposal hydration ────────────────────────────────────────────────────

type DemoTrip = {
  guestNames: string;
  adults: number;
  children: number;
  nights: number;
  destinations: string[];
  tripStyle: string;
  origin: string;
  operatorNote: string;
};

// Server returns the standard AutopilotResult plus tier-slot indices per
// day — the client uses those to pull images + full property metadata
// from STARTER_LIBRARY.
type DemoDraft = AutopilotResult & {
  days?: Array<
    Day & {
      tierSlots?: { classic: number; premier: number; signature: number };
    }
  >;
};

function hydrateDemoProposal(trip: DemoTrip, draft: DemoDraft, userImages: string[]) {
  const scaffold = buildBlankProposal();

  // ── Trip + client from the extracted enquiry intent ─────────────────
  scaffold.client.guestNames = trip.guestNames;
  scaffold.client.adults = trip.adults;
  scaffold.client.children = trip.children;
  scaffold.client.pax = formatPax(trip.adults, trip.children);
  if (trip.origin) scaffold.client.origin = trip.origin;
  scaffold.trip.title = `${trip.guestNames} — ${trip.destinations[0] ?? "East Africa"}`;
  scaffold.trip.subtitle = `${trip.destinations.join(" · ")} — ${trip.nights} nights`;
  scaffold.trip.nights = trip.nights;
  scaffold.trip.destinations = trip.destinations;
  scaffold.trip.tripStyle = trip.tripStyle;
  scaffold.trip.operatorNote = trip.operatorNote;
  scaffold.metadata.title = scaffold.trip.title;

  scaffold.operator.companyName = "Your safari company";
  scaffold.operator.consultantName = "Your consultant";
  scaffold.operator.email = "you@example.com";
  scaffold.operator.phone = "+254 700 000 000";

  const activeTier = pickActiveTier(trip.tripStyle);
  scaffold.activeTier = activeTier;

  const merged = mergeAutopilotIntoProposal(scaffold, draft);

  // ── Enrich days + properties from library slots (with optional
  //    user-image overlay so the output looks operator-branded).
  const pool = buildImagePool(userImages);
  const { days: enrichedDays, properties } = enrichDaysAndProperties(
    draft.days ?? [],
    merged.days,
    activeTier,
    pool,
  );
  merged.days = enrichedDays;
  merged.properties = properties;

  // ── Map coords + caption
  const coords = buildRouteCoords(enrichedDays);
  merged.sections = merged.sections.map((s): Section => {
    if (s.type !== "map") return s;
    return { ...s, content: { ...s.content, coords } };
  });

  // ── Cover hero: prefer a user image; else fall back to the first day's
  //    active-tier property lead image.
  const coverImage =
    pool.take() ??
    (() => {
      const firstSlot = draft.days?.[0]?.tierSlots?.[activeTier] ?? -1;
      if (firstSlot < 0 || firstSlot >= STARTER_LIBRARY.length) return null;
      return STARTER_LIBRARY[firstSlot].leadImageUrl;
    })();
  if (coverImage) {
    merged.sections = merged.sections.map((s): Section => {
      if (s.type !== "cover") return s;
      return { ...s, content: { ...s.content, heroImageUrl: coverImage } };
    });
  }

  useProposalStore.getState().hydrateProposal(merged);
}

// Cycling image pool. If the operator provided photos, they get first pick
// on every "next image" request; if they run out, we fall back to the
// starter-library images (via null → caller supplies its own fallback).
function buildImagePool(userImages: string[]) {
  let cursor = 0;
  const pool = userImages.slice();
  return {
    take(): string | null {
      if (pool.length === 0) return null;
      const img = pool[cursor % pool.length];
      cursor += 1;
      return img;
    },
    hasAny(): boolean {
      return pool.length > 0;
    },
    size(): number {
      return pool.length;
    },
  };
}

function pickActiveTier(tripStyle: string): TierKey {
  const s = tripStyle.toLowerCase();
  if (s.includes("luxury")) return "signature";
  if (s.includes("classic")) return "classic";
  return "premier";
}

function enrichDaysAndProperties(
  serverDays: Array<Day & { tierSlots?: { classic: number; premier: number; signature: number } }>,
  mergedDays: Day[],
  activeTier: TierKey,
  pool: ReturnType<typeof buildImagePool>,
): { days: Day[]; properties: Property[] } {
  const usedSlots: number[] = [];
  const days = mergedDays.map((d, i) => {
    const slots = serverDays[i]?.tierSlots;

    // Accumulate every unique slot across every tier for the property
    // showcase — preserves order of first appearance.
    for (const key of ["classic", "premier", "signature"] as const) {
      const slot = slots?.[key] ?? -1;
      if (slot >= 0 && slot < STARTER_LIBRARY.length && !usedSlots.includes(slot)) {
        usedSlots.push(slot);
      }
    }

    // Day hero — user image first, else active tier's gallery[0], else leadImage
    const activeSlot = slots?.[activeTier] ?? -1;
    const starter = activeSlot >= 0 && activeSlot < STARTER_LIBRARY.length
      ? STARTER_LIBRARY[activeSlot]
      : null;
    const heroImageUrl =
      pool.take() ??
      (starter ? starter.galleryUrls[0] ?? starter.leadImageUrl : d.heroImageUrl);
    if (heroImageUrl) d.heroImageUrl = heroImageUrl;
    return d;
  });

  const properties: Property[] = usedSlots.map((slot) => {
    const s = STARTER_LIBRARY[slot];
    const nights =
      days.reduce((n, d) => {
        const match = d.tiers[activeTier]?.camp?.trim().toLowerCase() === s.name.toLowerCase();
        return n + (match ? 1 : 0);
      }, 0) || 1;

    // Lead image — user pool first; if no user image left, fall back to
    // the starter library's own lead. Gallery — first user image, then
    // any remaining from starter gallery, capped at 4 frames.
    const leadUser = pool.take();
    const leadImageUrl = leadUser ?? s.leadImageUrl;
    const gallery: string[] = [];
    while (gallery.length < 3 && pool.hasAny()) {
      const next = pool.take();
      if (next) gallery.push(next);
      else break;
    }
    const galleryUrls = gallery.length > 0
      ? [...gallery, ...s.galleryUrls].slice(0, 4)
      : s.galleryUrls.slice(0, 4);

    return {
      id: nanoid(),
      name: s.name,
      location: s.locationName,
      shortDesc: s.shortSummary,
      description: s.whatMakesSpecial,
      whyWeChoseThis: s.whyWeChoose,
      amenities: s.amenities,
      mealPlan: s.mealPlan,
      roomType: s.propertyClass,
      nights,
      leadImageUrl,
      galleryUrls,
      checkInTime: s.checkInTime,
      checkOutTime: s.checkOutTime,
      totalRooms: s.totalRooms,
      spokenLanguages: s.spokenLanguages,
      specialInterests: s.specialInterests,
    };
  });

  return { days, properties };
}

function buildRouteCoords(days: Day[]): RouteCoord[] {
  const coords: RouteCoord[] = [];
  for (const d of days) {
    const c = lookupDemoCoord(d.destination);
    if (!c) continue;
    coords.push({
      dayId: d.id,
      dayNumber: d.dayNumber,
      label: d.destination,
      lat: c.lat,
      lng: c.lng,
    });
  }
  return coords;
}

function formatPax(adults: number, children: number): string {
  if (children > 0) return `${adults} adults · ${children} children`;
  return `${adults} ${adults === 1 ? "adult" : "adults"}`;
}
