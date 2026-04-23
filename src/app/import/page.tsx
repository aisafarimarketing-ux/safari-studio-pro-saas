"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/pdfExtract";
import { buildBlankProposal } from "@/lib/defaults";
import { nanoid } from "@/lib/nanoid";
import type { Day, PracticalCard, Proposal, TierKey } from "@/lib/types";

// ─── /import ────────────────────────────────────────────────────────────────
//
// Bring-your-old-proposals page. The switching-cost killer for ops on
// Safariportal / Safari Office / Wetu. Three phases:
//
//   1. Input      — upload a PDF (extracted client-side via pdfjs) or
//                   paste text from any source.
//   2. Extracting — hummingbird animated loader; /api/ai/import-proposal
//                   returns a structured ExtractedProposal.
//   3. Preview    — summary (trip, days, pricing, unmatched camps) with
//                   "Open in editor" CTA that saves via /api/proposals
//                   and hands off to /studio/[id].

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";
const BONE = "#f8f5ef";

const MAX_PASTE_CHARS = 60_000;

const EXTRACTION_STAGES = [
  "Reading your proposal…",
  "Finding guests and dates…",
  "Matching camps to your library…",
  "Extracting pricing…",
  "Structuring days…",
  "Preserving your voice…",
  "Almost there…",
];

type InputMode = "pdf" | "text";
type Phase =
  | { kind: "input" }
  | { kind: "extracting" }
  | { kind: "preview"; extraction: ExtractedProposal }
  | { kind: "saving"; extraction: ExtractedProposal }
  | { kind: "error"; message: string; fallbackExtraction?: ExtractedProposal };

// Keep this in lockstep with the API's response shape.
type ExtractedTierPick = {
  librarySlot: number;
  propertyId: string | null;
  campName: string;
  location: string;
  note: string;
};
type ExtractedDay = {
  dayNumber: number;
  destination: string;
  country: string;
  subtitle: string;
  description: string;
  board: string;
  highlights: string[];
  tiers: Record<TierKey, ExtractedTierPick>;
};
type ExtractedProposal = {
  client: {
    guestNames: string;
    adults: number;
    children: number;
    origin: string;
    rooming: string;
    arrivalFlight: string;
    departureFlight: string;
    dietary: string;
    specialOccasion: string;
  };
  trip: {
    title: string;
    subtitle: string;
    dates: string;
    arrivalDate: string;
    departureDate: string;
    nights: number;
    destinations: string[];
    tripStyle: string;
    operatorNote: string;
  };
  days: ExtractedDay[];
  pricing: {
    classic: { label: string; pricePerPerson: string; currency: string };
    premier: { label: string; pricePerPerson: string; currency: string };
    signature: { label: string; pricePerPerson: string; currency: string };
    notes: string;
  };
  inclusions: string[];
  exclusions: string[];
  practicalInfo: { id: string; title: string; body: string; icon: string }[];
  cover: { tagline: string };
  greeting: { body: string };
  closing: { quote: string; signOff: string };
  unmatchedCamps: string[];
};

export default function ImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const [mode, setMode] = useState<InputMode>("pdf");
  const [pastedText, setPastedText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate the progress rail while extraction is in flight.
  useEffect(() => {
    if (phase.kind !== "extracting") {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }
    setProgress(0);
    setStageIndex(0);
    const startedAt = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const t = Math.min(1, elapsed / 30);
      const eased = 1 - Math.pow(2, -6 * t);
      const pct = Math.min(85, Math.round(eased * 85));
      setProgress(pct);
      const stage = Math.min(
        EXTRACTION_STAGES.length - 1,
        Math.floor(pct / (85 / EXTRACTION_STAGES.length)),
      );
      setStageIndex(stage);
    }, 120);
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [phase.kind]);

  // ── Run the extraction pipeline ────────────────────────────────────────
  const handleExtract = async () => {
    let source = "";
    let sourceFormat: "pdf" | "text" = "text";

    setPhase({ kind: "extracting" });

    try {
      if (mode === "pdf") {
        if (!pdfFile) {
          setPhase({ kind: "error", message: "Pick a PDF first." });
          return;
        }
        sourceFormat = "pdf";
        source = await extractPdfText(pdfFile, { maxPages: 40, maxChars: MAX_PASTE_CHARS });
        if (!source || source.length < 80) {
          setPhase({
            kind: "error",
            message:
              "Couldn't pull much text out of that PDF — if it's a scanned document, try pasting the content instead.",
          });
          return;
        }
      } else {
        source = pastedText.trim().slice(0, MAX_PASTE_CHARS);
        if (source.length < 80) {
          setPhase({
            kind: "error",
            message: "Paste at least a paragraph or two so there's something to extract.",
          });
          return;
        }
      }

      const res = await fetch("/api/ai/import-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, sourceFormat }),
      });
      if (res.status === 409) { router.push("/select-organization"); return; }
      if (res.status === 402) { router.push("/account-suspended"); return; }
      if (res.status === 401) { router.push("/sign-in"); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPhase({ kind: "error", message: data?.error ?? "Import failed. Please retry." });
        return;
      }
      const extraction = (await res.json()) as ExtractedProposal;
      setProgress(100);
      setStageIndex(EXTRACTION_STAGES.length - 1);
      await new Promise((r) => setTimeout(r, 350));
      setPhase({ kind: "preview", extraction });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Unexpected error. Please retry.",
      });
    }
  };

  // ── Save the extracted proposal and open it in the editor ──────────────
  const handleOpenInEditor = async (extraction: ExtractedProposal) => {
    setPhase({ kind: "saving", extraction });
    try {
      const proposal = buildProposalFromExtraction(extraction);
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
      });
      if (res.status === 409) { router.push("/select-organization"); return; }
      if (res.status === 402) { router.push("/account-suspended"); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPhase({
          kind: "error",
          message: data?.error ?? "Couldn't save the proposal. Please retry.",
          fallbackExtraction: extraction,
        });
        return;
      }
      try { localStorage.setItem("activeProposalId", proposal.id); } catch {}
      router.push(`/studio/${proposal.id}`);
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Save failed. Please retry.",
        fallbackExtraction: extraction,
      });
    }
  };

  const handleReset = () => {
    setPhase({ kind: "input" });
    setPastedText("");
    setPdfFile(null);
    setProgress(0);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: BONE }}>
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-10 pt-24">
        {phase.kind === "input" && (
          <InputView
            mode={mode}
            setMode={setMode}
            pastedText={pastedText}
            setPastedText={setPastedText}
            pdfFile={pdfFile}
            setPdfFile={setPdfFile}
            fileInputRef={fileInputRef}
            onExtract={handleExtract}
            errorMsg={null}
          />
        )}

        {phase.kind === "extracting" && (
          <ExtractingView progress={progress} stage={EXTRACTION_STAGES[stageIndex] ?? EXTRACTION_STAGES[0]} />
        )}

        {phase.kind === "preview" && (
          <PreviewView
            extraction={phase.extraction}
            onReset={handleReset}
            onOpen={() => handleOpenInEditor(phase.extraction)}
            saving={false}
          />
        )}

        {phase.kind === "saving" && (
          <PreviewView
            extraction={phase.extraction}
            onReset={handleReset}
            onOpen={() => {}}
            saving={true}
          />
        )}

        {phase.kind === "error" && (
          <ErrorView
            message={phase.message}
            extraction={phase.fallbackExtraction ?? null}
            onReset={handleReset}
            onRetryOpen={
              phase.fallbackExtraction
                ? () => handleOpenInEditor(phase.fallbackExtraction!)
                : undefined
            }
          />
        )}
      </main>
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 border-b backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.88)", borderColor: "rgba(0,0,0,0.06)" }}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="text-[13px] text-black/55 hover:text-black/85 transition"
        >
          ← Dashboard
        </Link>
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
          Import a proposal
        </div>
        <Link
          href="/proposals"
          className="text-[13px] text-black/55 hover:text-black/85 transition"
        >
          My proposals →
        </Link>
      </div>
    </header>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────

function InputView({
  mode,
  setMode,
  pastedText,
  setPastedText,
  pdfFile,
  setPdfFile,
  fileInputRef,
  onExtract,
  errorMsg,
}: {
  mode: InputMode;
  setMode: (m: InputMode) => void;
  pastedText: string;
  setPastedText: (v: string) => void;
  pdfFile: File | null;
  setPdfFile: (f: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onExtract: () => void;
  errorMsg: string | null;
}) {
  const canSubmit =
    (mode === "pdf" && pdfFile !== null) ||
    (mode === "text" && pastedText.trim().length >= 80);

  return (
    <>
      <div className="text-center mb-8">
        <h1
          className="text-3xl md:text-4xl font-bold tracking-tight text-black/85"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Bring your last proposal.
          <br />
          <em className="not-italic" style={{ color: FOREST }}>We&apos;ll restructure it.</em>
        </h1>
        <p className="mt-4 text-[15px] text-black/60 max-w-xl mx-auto leading-relaxed">
          Drop a PDF from Safariportal, Safari Office, Wetu, Word — anything — and we
          pull out the client, days, camps, and pricing. Your voice is preserved; only
          the structure changes.
        </p>
      </div>

      <div
        className="rounded-2xl bg-white border shadow-sm overflow-hidden"
        style={{ borderColor: "rgba(0,0,0,0.08)" }}
      >
        <div className="flex border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <TabButton active={mode === "pdf"} onClick={() => setMode("pdf")}>
            Upload PDF
          </TabButton>
          <TabButton active={mode === "text"} onClick={() => setMode("text")}>
            Paste text
          </TabButton>
        </div>

        {mode === "pdf" ? (
          <div className="p-6">
            <div
              className="rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition hover:border-black/25"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && f.type === "application/pdf") setPdfFile(f);
              }}
            >
              {pdfFile ? (
                <div>
                  <div className="text-[14px] font-semibold text-black/80">{pdfFile.name}</div>
                  <div className="text-[12px] text-black/45 mt-1">
                    {(pdfFile.size / 1024).toFixed(0)} KB · click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[14px] font-medium text-black/70">Drop a PDF here</div>
                  <div className="text-[12px] text-black/45 mt-1">
                    or click to choose · your file stays in your browser
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPdfFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>
        ) : (
          <div className="p-0">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste the proposal text — or the body of the email your client sent. The longer the better; we work with anything from a short brief to a 10-page itinerary."
              rows={14}
              className="block w-full px-5 py-4 text-[14px] leading-relaxed text-black/85 outline-none resize-none placeholder:text-black/35"
              maxLength={MAX_PASTE_CHARS}
            />
            <div
              className="px-5 py-2.5 border-t flex items-center justify-end"
              style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.015)" }}
            >
              <div className="text-[12px] text-black/40 tabular-nums">
                {pastedText.length} / {MAX_PASTE_CHARS}
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-xl px-4 py-3 text-[13.5px] text-[#7a2e23] bg-[#f4d7d0] border border-[#e3b5ac]">
          {errorMsg}
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onExtract}
          disabled={!canSubmit}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-[15px] font-semibold transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: GOLD, color: FOREST }}
        >
          Extract the structure →
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px] text-black/60">
        <Hint
          symbol="◇"
          title="Your voice survives"
          body="We preserve the operator's prose — we restructure, we don't rewrite."
        />
        <Hint
          symbol="◐"
          title="Camps match your library"
          body="Any camp already in your library links automatically. Unmatched ones stay as free text."
        />
        <Hint
          symbol="◈"
          title="Nothing is saved yet"
          body="You review the extraction first, then decide to open it in the editor."
        />
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-[13px] font-medium py-3 transition ${
        active ? "text-[#1b3a2d] border-b-2 border-[#1b3a2d]" : "text-black/50 hover:text-black/75"
      }`}
    >
      {children}
    </button>
  );
}

function Hint({ symbol, title, body }: { symbol: string; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-white border p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none" style={{ color: FOREST }}>{symbol}</div>
        <div>
          <div className="font-semibold text-black/80 text-[13.5px]">{title}</div>
          <div className="mt-0.5 text-black/55 leading-relaxed">{body}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Extracting ────────────────────────────────────────────────────────────

function ExtractingView({ progress, stage }: { progress: number; stage: string }) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="rounded-2xl bg-white border shadow-sm p-10" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="text-center mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
          Working
        </div>
        <h2
          className="mt-3 text-2xl font-bold tracking-tight text-black/85"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {stage}
        </h2>
      </div>

      <div className="mx-auto max-w-xl">
        <div className="relative h-14">
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
            style={{ background: "rgba(27,58,45,0.12)" }}
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${FOREST}, ${GOLD})`,
              boxShadow: `0 0 10px ${GOLD}66`,
            }}
          />
          <div
            className="absolute top-1/2 hummingbird-fly"
            style={{
              left: `${pct}%`,
              transform: "translate(-50%, -50%)",
              transition: "left 500ms ease-out",
            }}
          >
            <HummingbirdSVG />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12.5px]">
          <div className="text-black/55">PDF → structure</div>
          <div className="tabular-nums font-semibold" style={{ color: FOREST }}>{pct}%</div>
        </div>
        <div className="mt-2 text-center text-[11.5px] text-black/40">
          Usually done in 15 – 40 seconds
        </div>
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
  return (
    <svg width="42" height="28" viewBox="0 0 42 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 2px 3px rgba(27,58,45,0.25))` }}
    >
      <path d="M4 14 L0 10 L1 14 L0 18 Z" fill={FOREST} />
      <path
        d="M4 14 C 10 9, 18 10, 24 13 C 26 14, 26 15, 24 16 C 18 18, 10 18, 4 14 Z"
        fill={FOREST}
      />
      <circle cx="25" cy="13" r="3.5" fill={FOREST} />
      <circle cx="26" cy="12.5" r="0.7" fill="white" />
      <path d="M28 13 L41 13.3 L28 14 Z" fill={GOLD} />
      <path
        d="M22 14.5 C 24 15.5, 25 15.3, 25 14 C 24 13.6, 22 13.8, 22 14.5 Z"
        fill={GOLD}
        opacity="0.7"
      />
      <g className="hummingbird-wing">
        <ellipse cx="16" cy="10" rx="9" ry="6" fill={FOREST} opacity="0.55" />
      </g>
    </svg>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────

function PreviewView({
  extraction,
  onReset,
  onOpen,
  saving,
}: {
  extraction: ExtractedProposal;
  onReset: () => void;
  onOpen: () => void;
  saving: boolean;
}) {
  const { trip, client, days, pricing, unmatchedCamps, inclusions, exclusions, practicalInfo, greeting, closing } = extraction;
  const matchedCount = days.reduce((n, d) => {
    const hasMatch = Object.values(d.tiers).some((t) => t.propertyId);
    return n + (hasMatch ? 1 : 0);
  }, 0);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: FOREST }}>
          Extracted
        </div>
        <h1
          className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-black/85"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {trip.title || "Imported proposal"}
        </h1>
        {(trip.subtitle || trip.dates) && (
          <div className="mt-2 text-[14px] text-black/55">
            {trip.subtitle || trip.dates}
          </div>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryTile label="Guests" value={client.guestNames || "—"} />
        <SummaryTile label="Pax" value={paxLabel(client.adults, client.children)} />
        <SummaryTile label="Nights" value={trip.nights > 0 ? `${trip.nights}` : "—"} />
        <SummaryTile label="Style" value={trip.tripStyle || "—"} />
      </div>

      {/* Day list */}
      <Card title={`Days (${days.length})`}>
        <ul className="divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {days.map((d) => (
            <li key={d.dayNumber} className="py-3 first:pt-0 last:pb-0 flex items-baseline gap-4">
              <div className="w-12 text-[11px] uppercase tracking-wider text-black/35 tabular-nums shrink-0">
                Day {d.dayNumber}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-semibold text-black/85 truncate">
                  {d.destination || "—"}
                  {d.country && <span className="text-black/45 font-normal"> · {d.country}</span>}
                </div>
                <div className="text-[13px] text-black/55 truncate mt-0.5">
                  {summariseTiers(d.tiers)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Pricing tiles (show only if any tier has a price) */}
      {hasAnyPricing(pricing) && (
        <Card title="Pricing">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["classic", "premier", "signature"] as const).map((t) => (
              <div
                key={t}
                className="rounded-lg border px-4 py-3"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                <div className="text-[10.5px] uppercase tracking-wider text-black/45 font-semibold">
                  {pricing[t].label}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5 text-black/85">
                  <span className="text-xl font-bold tabular-nums">
                    {pricing[t].pricePerPerson || "—"}
                  </span>
                  <span className="text-[12px] text-black/45">{pricing[t].currency}</span>
                </div>
                <div className="text-[11px] text-black/45 mt-0.5">per person</div>
              </div>
            ))}
          </div>
          {pricing.notes && <div className="mt-3 text-[12.5px] text-black/55">{pricing.notes}</div>}
        </Card>
      )}

      {/* Greeting + closing preview — quick sanity check on voice preservation */}
      {(greeting.body || closing.signOff) && (
        <Card title="Copy preview">
          {greeting.body && (
            <>
              <div className="text-[10.5px] uppercase tracking-wider text-black/45 font-semibold mb-1.5">Greeting</div>
              <div className="text-[13.5px] text-black/75 leading-relaxed whitespace-pre-wrap">
                {greeting.body}
              </div>
            </>
          )}
          {closing.signOff && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="text-[10.5px] uppercase tracking-wider text-black/45 font-semibold mb-1.5">Closing</div>
              <div className="text-[13.5px] text-black/75 leading-relaxed whitespace-pre-wrap">
                {closing.signOff}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Unmatched camps — nudge to populate the library */}
      {unmatchedCamps.length > 0 && (
        <Card title="Camps not in your library yet">
          <div className="text-[13px] text-black/60 mb-2.5 leading-relaxed">
            These camps were mentioned in the source but aren&apos;t in your property library.
            They&apos;ll come across as free text — you can add them properly from the Properties tab later.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unmatchedCamps.map((c) => (
              <span
                key={c}
                className="inline-block text-[12px] px-2.5 py-1 rounded-full border text-black/70"
                style={{ borderColor: "rgba(201,168,76,0.5)", background: "rgba(201,168,76,0.08)" }}
              >
                {c}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Inclusions / exclusions — cursory list */}
      {(inclusions.length > 0 || exclusions.length > 0) && (
        <Card title="What's in / out">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] text-black/70">
            {inclusions.length > 0 && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-[#1b3a2d] font-semibold mb-1.5">
                  Included ({inclusions.length})
                </div>
                <ul className="space-y-1 list-none">
                  {inclusions.slice(0, 10).map((s, i) => (
                    <li key={i} className="pl-3 relative">
                      <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-[#1b3a2d]" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exclusions.length > 0 && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-black/45 font-semibold mb-1.5">
                  Excluded ({exclusions.length})
                </div>
                <ul className="space-y-1 list-none">
                  {exclusions.slice(0, 10).map((s, i) => (
                    <li key={i} className="pl-3 relative">
                      <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-black/40" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {practicalInfo.length > 0 && (
        <Card title={`Practical info (${practicalInfo.length})`}>
          <div className="text-[13px] text-black/55">
            {practicalInfo.map((c) => c.title).filter(Boolean).join(" · ")}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          onClick={onReset}
          disabled={saving}
          className="text-[13.5px] text-black/55 hover:text-black/85 transition px-3 py-2 disabled:opacity-50"
        >
          ← Try another
        </button>
        <div className="flex items-center gap-3">
          <div className="text-[12px] text-black/45 hidden sm:block">
            {matchedCount}/{days.length} days matched to your library
          </div>
          <button
            onClick={onOpen}
            disabled={saving}
            className="w-full sm:w-auto px-7 py-3 rounded-xl text-[14.5px] font-semibold transition active:scale-95 disabled:opacity-60"
            style={{ background: FOREST, color: "white" }}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Opening…
              </span>
            ) : (
              "Open in editor →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl bg-white border p-5 mb-4"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] font-semibold mb-3"
        style={{ color: FOREST }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">{label}</div>
      <div className="mt-1 text-[14px] font-semibold text-black/80 truncate">{value}</div>
    </div>
  );
}

// ─── Error ─────────────────────────────────────────────────────────────────

function ErrorView({
  message,
  extraction,
  onReset,
  onRetryOpen,
}: {
  message: string;
  extraction: ExtractedProposal | null;
  onReset: () => void;
  onRetryOpen?: () => void;
}) {
  return (
    <div
      className="rounded-2xl bg-white border p-8 text-center"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div
        className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center text-[#b34334] text-xl font-bold mb-4"
        style={{ background: "rgba(179,67,52,0.1)" }}
      >
        !
      </div>
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#b34334]">
        Import failed
      </div>
      <p className="mt-3 text-[15px] text-black/70 max-w-sm mx-auto">{message}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onReset}
          className="px-4 py-2 text-[13px] rounded-lg border text-black/65 hover:bg-black/5 transition"
          style={{ borderColor: "rgba(0,0,0,0.12)" }}
        >
          Start over
        </button>
        {extraction && onRetryOpen && (
          <button
            onClick={onRetryOpen}
            className="px-4 py-2 text-[13px] rounded-lg font-semibold transition active:scale-95"
            style={{ background: FOREST, color: "white" }}
          >
            Retry save
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function paxLabel(adults: number, children: number): string {
  if (!adults && !children) return "—";
  if (children > 0) return `${adults}A · ${children}C`;
  return `${adults} ${adults === 1 ? "adult" : "adults"}`;
}

function summariseTiers(
  tiers: Record<TierKey, { campName: string; propertyId: string | null }>,
): string {
  const uniqueCamps = new Set<string>();
  for (const t of ["classic", "premier", "signature"] as const) {
    const c = tiers[t].campName?.trim();
    if (c) uniqueCamps.add(c);
  }
  if (uniqueCamps.size === 0) return "No camps extracted";
  const labelled = Array.from(uniqueCamps);
  const matched = Object.values(tiers).some((t) => t.propertyId);
  const tag = matched ? "· library match" : "· free text";
  return `${labelled.slice(0, 3).join(" · ")} ${tag}`;
}

function hasAnyPricing(pricing: ExtractedProposal["pricing"]): boolean {
  return Boolean(
    pricing.classic.pricePerPerson ||
      pricing.premier.pricePerPerson ||
      pricing.signature.pricePerPerson,
  );
}

// ─── Build the full Proposal for save ───────────────────────────────────────
// Takes the ExtractedProposal the server returned and weaves it into a
// fresh blank scaffold. The result is a valid Proposal that /api/proposals
// accepts directly. Matched property IDs are carried through on the days;
// we don't populate proposal.properties[] here (operator adds those from
// their library in the editor) — day cards fall back to the "phantom"
// property render path when a name isn't in proposal.properties.

function buildProposalFromExtraction(extraction: ExtractedProposal): Proposal {
  const p = buildBlankProposal();
  const { client, trip, days, pricing, inclusions, exclusions, practicalInfo, cover, greeting, closing } = extraction;

  // ── Metadata + trip ─────────────────────────────────────────────────
  const title = trip.title || `${client.guestNames || "Imported"} safari`;
  p.metadata.title = title;
  p.trip.title = title;
  p.trip.subtitle = trip.subtitle;
  p.trip.dates = trip.dates;
  if (trip.arrivalDate) p.trip.arrivalDate = trip.arrivalDate;
  if (trip.departureDate) p.trip.departureDate = trip.departureDate;
  p.trip.nights = trip.nights || days.length;
  p.trip.destinations = trip.destinations;
  if (trip.tripStyle) p.trip.tripStyle = trip.tripStyle;
  if (trip.operatorNote) p.trip.operatorNote = trip.operatorNote;

  // ── Client ──────────────────────────────────────────────────────────
  p.client.guestNames = client.guestNames;
  p.client.adults = client.adults || undefined;
  p.client.children = client.children || undefined;
  p.client.pax = client.adults
    ? (client.children > 0
        ? `${client.adults} adults · ${client.children} children`
        : `${client.adults} ${client.adults === 1 ? "adult" : "adults"}`)
    : "";
  if (client.origin) p.client.origin = client.origin;
  if (client.rooming) p.client.rooming = client.rooming;
  if (client.arrivalFlight) p.client.arrivalFlight = client.arrivalFlight;
  if (client.departureFlight) p.client.departureFlight = client.departureFlight;
  if (client.dietary) p.client.dietary = client.dietary;
  if (client.specialOccasion) p.client.specialOccasion = client.specialOccasion;

  // ── Days ────────────────────────────────────────────────────────────
  p.days = days.map((d): Day => ({
    id: nanoid(),
    dayNumber: d.dayNumber,
    destination: d.destination,
    country: d.country,
    subtitle: d.subtitle || undefined,
    description: d.description,
    board: d.board || "Full board",
    highlights: d.highlights.length > 0 ? d.highlights : undefined,
    tiers: {
      classic:   { camp: d.tiers.classic.campName,   location: d.tiers.classic.location,   note: d.tiers.classic.note },
      premier:   { camp: d.tiers.premier.campName,   location: d.tiers.premier.location,   note: d.tiers.premier.note },
      signature: { camp: d.tiers.signature.campName, location: d.tiers.signature.location, note: d.tiers.signature.note },
    },
  }));

  // ── Pricing ─────────────────────────────────────────────────────────
  p.pricing = {
    classic:   { ...p.pricing.classic,   label: pricing.classic.label,   pricePerPerson: pricing.classic.pricePerPerson,   currency: pricing.classic.currency || "USD" },
    premier:   { ...p.pricing.premier,   label: pricing.premier.label,   pricePerPerson: pricing.premier.pricePerPerson,   currency: pricing.premier.currency || "USD" },
    signature: { ...p.pricing.signature, label: pricing.signature.label, pricePerPerson: pricing.signature.pricePerPerson, currency: pricing.signature.currency || "USD" },
    notes: pricing.notes || undefined,
  };
  // Mark "premier" highlighted by default — operator can change it
  p.pricing.premier.highlighted = true;

  // ── Proposal-level arrays ───────────────────────────────────────────
  p.inclusions = inclusions;
  p.exclusions = exclusions;
  p.practicalInfo = practicalInfo as PracticalCard[];

  // ── Section content patches (cover / greeting / closing) ────────────
  p.sections = p.sections.map((s) => {
    switch (s.type) {
      case "cover":
        if (cover.tagline) return { ...s, content: { ...s.content, tagline: cover.tagline } };
        return s;
      case "greeting":
        if (greeting.body) return { ...s, content: { ...s.content, body: greeting.body } };
        return s;
      case "closing": {
        const content = { ...s.content };
        if (closing.quote) content.quote = closing.quote;
        if (closing.signOff) content.signOff = closing.signOff;
        return { ...s, content };
      }
      default:
        return s;
    }
  });

  return p;
}
