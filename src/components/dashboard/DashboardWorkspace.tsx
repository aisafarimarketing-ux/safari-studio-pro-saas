"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { AppHeader } from "@/components/properties/AppHeader";
import { CompletionRing } from "@/components/brand-dna/CompletionRing";
import type { BrandDNACompletion } from "@/lib/brandDNA";
import { buildDemoProposal } from "@/lib/defaults";
import { nanoid } from "@/lib/nanoid";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { TierBanner } from "./TierBanner";
import { TripSetupDialog, type TripSetupResult } from "@/components/trip-setup/TripSetupDialog";
import { mergeAutopilotIntoProposal, type AutopilotResult } from "@/lib/autopilotMerge";

// ─── Workspace dashboard ────────────────────────────────────────────────────
//
// One-page operator workspace. Welcome → active proposal → quick actions →
// properties + brand DNA snapshots → recent work. Designed to answer
// "what should I do next?" at a glance, without ever feeling like an admin
// panel. Pulls all state from existing endpoints in parallel — no new API.

type ProposalRow = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  clientName: string | null;
};
type LocationLite = { id: string; name: string; country: string | null };
type PropertyRow = {
  id: string;
  name: string;
  location: LocationLite | null;
  images: { id: string; url: string }[];
};

export function DashboardWorkspace() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [proposals, setProposals] = useState<ProposalRow[] | null>(null);
  const [properties, setProperties] = useState<PropertyRow[] | null>(null);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [completion, setCompletion] = useState<BrandDNACompletion | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tripSetupOpen, setTripSetupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [propRes, propertyRes, locRes, brandRes] = await Promise.all([
          fetch("/api/proposals", { cache: "no-store" }),
          fetch("/api/properties", { cache: "no-store" }),
          fetch("/api/locations", { cache: "no-store" }),
          fetch("/api/brand-dna", { cache: "no-store" }),
        ]);
        if (propRes.status === 401) { window.location.href = "/sign-in?redirect_url=/dashboard"; return; }
        if (propRes.status === 409) { window.location.href = "/select-organization"; return; }
        if (propRes.status === 402) { window.location.href = "/account-suspended"; return; }

        const propData = propRes.ok ? await propRes.json() : { proposals: [] };
        const propertyData = propertyRes.ok ? await propertyRes.json() : { properties: [] };
        const locData = locRes.ok ? await locRes.json() : { locations: [] };
        const brandData = brandRes.ok ? await brandRes.json() : null;

        setProposals(propData.proposals ?? []);
        setProperties(propertyData.properties ?? []);
        setLocationCount((locData.locations ?? []).length);
        setCompletion(brandData?.completion ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace");
      }
    })();
  }, []);

  // New proposal now runs through Trip Setup — a fast structured entry flow.
  // Click "+ New proposal" → modal opens → submit builds a configured
  // proposal and POSTs it, then routes to /studio.
  const openNewProposal = () => setTripSetupOpen(true);

  const handleTripSetupSubmit = async ({ proposal, autopilot }: TripSetupResult) => {
    if (creating) return;
    setCreating(true);
    try {
      // 1. Always save the blank-but-configured proposal first. If anything
      //    later fails the user still lands in the editor with their setup.
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { localStorage.setItem("activeProposalId", proposal.id); } catch {}

      // 2. Optional AI draft — fills every section of the proposal from the
      //    Trip Setup facts. Soft-fails: if the model errors out, we still
      //    open the editor with the blank-but-configured proposal.
      if (autopilot) {
        try {
          const ai = await fetch("/api/ai/autopilot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proposal }),
          });
          if (ai.ok) {
            const draft = (await ai.json()) as AutopilotResult;
            const merged = mergeAutopilotIntoProposal(proposal, draft);
            await fetch("/api/proposals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ proposal: merged }),
            });
          } else {
            console.warn("[autopilot] non-OK:", ai.status);
          }
        } catch (err) {
          console.warn("[autopilot] failed; opening blank editor instead:", err);
        }
      }

      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create proposal");
      setCreating(false);
    }
  };

  // Import-sample uses the existing Family Safari template — fully populated
  // with days, properties, pricing, inclusions. Onboarding (Part 5) replaces
  // this with a richer "Best of Kenya" demo + checklist.
  const handleImportSample = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const sample = buildDemoProposal();
      // Always assign a fresh id so re-importing creates a new copy.
      sample.id = nanoid();
      sample.metadata = {
        ...sample.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: sample }),
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { localStorage.setItem("activeProposalId", sample.id); } catch {}
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import sample");
      setImporting(false);
    }
  };

  const orgName = organization?.name ?? "your workspace";
  const activeProposal = proposals?.[0] ?? null;
  const recentProposals = proposals?.slice(1, 4) ?? [];
  const propertyCount = properties?.length ?? null;

  return (
    <div className="min-h-screen text-[#1a1a1a] relative overflow-hidden" style={{ background: "#f8f5ef" }}>
      <DashboardBackdrop />
      <AppHeader />

      <main className="max-w-6xl mx-auto px-6 py-10 md:py-12 relative">
        {/* Welcome */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black/85">
            Welcome back, <span className="text-[#1b3a2d]">{orgName}</span>.
          </h1>
          <p className="mt-2 text-[15px] text-black/55">
            {activeProposal
              ? "Pick up where you left off, or start something new."
              : "Start your first proposal — or build out the property library that powers them."}
          </p>
        </header>

        <TierBanner />

        {error && (
          <div className="mb-6 rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[#b34334] text-sm">
            {error}
          </div>
        )}

        {/* Onboarding checklist — derived from real workspace data, auto-
            disappears once everything's done. Dismissible per session. */}
        {proposals !== null && properties !== null && (
          <OnboardingChecklist
            progress={{
              hasProperties: (properties?.length ?? 0) > 0,
              hasProposals: (proposals?.length ?? 0) > 0,
              brandDNAComplete: (completion?.overall ?? 0) >= 60,
            }}
          />
        )}

        {/* Active proposal hero */}
        <ActiveProposalCard
          loaded={proposals !== null}
          proposal={activeProposal}
          onNew={openNewProposal}
          creating={creating}
          onImportSample={handleImportSample}
          importing={importing}
        />

        {/* Triple snapshot row */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <QuickActionsCard
            onNew={openNewProposal}
            creating={creating}
            onImportSample={handleImportSample}
            importing={importing}
            hasProposals={(proposals?.length ?? 0) > 0}
          />
          <PropertiesCard
            count={propertyCount}
            locations={locationCount}
            recent={properties?.slice(0, 3) ?? []}
          />
          <BrandDNACard completion={completion} />
        </div>

        {/* Recent proposals */}
        {recentProposals.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[18px] font-semibold text-black/80">Recent proposals</h2>
              <Link
                href="/proposals"
                className="text-[13px] text-black/45 hover:text-[#1b3a2d] transition"
              >
                View all →
              </Link>
            </div>
            <ul className="bg-white rounded-2xl border border-black/8 divide-y divide-black/8 overflow-hidden">
              {recentProposals.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      try { localStorage.setItem("activeProposalId", p.id); } catch {}
                      router.push("/studio");
                    }}
                    className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-black/[0.02] transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] text-black/85 truncate">
                        {p.title || "Untitled Proposal"}
                      </div>
                      <div className="text-[12px] text-black/45 mt-0.5 truncate">
                        {p.clientName ? `${p.clientName} · ` : ""}
                        Edited {formatRelative(p.updatedAt)}
                      </div>
                    </div>
                    <span className="text-black/30 group-hover:text-[#1b3a2d] text-base shrink-0">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {tripSetupOpen && (
        <TripSetupDialog
          onClose={() => { if (!creating) setTripSetupOpen(false); }}
          onSubmit={handleTripSetupSubmit}
          submitting={creating}
        />
      )}
    </div>
  );
}

// ─── Active proposal card ───────────────────────────────────────────────────

function ActiveProposalCard({
  loaded,
  proposal,
  onNew,
  creating,
  onImportSample,
  importing,
}: {
  loaded: boolean;
  proposal: ProposalRow | null;
  onNew: () => void;
  creating: boolean;
  onImportSample: () => void;
  importing: boolean;
}) {
  const router = useRouter();

  if (!loaded) {
    return <div className="rounded-2xl bg-white border border-black/8 h-40 animate-pulse" />;
  }

  if (!proposal) {
    return (
      <div className="rounded-2xl bg-white border border-dashed border-black/15 p-10 text-center">
        <div
          className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-[#c9a84c] text-xl font-bold mb-4"
          style={{ background: "rgba(201,168,76,0.15)" }}
        >
          ✦
        </div>
        <h2 className="text-lg font-semibold text-black/85">Start your first proposal</h2>
        <p className="mt-1.5 text-[14px] text-black/50 max-w-md mx-auto">
          Fill in a few facts about your guests and the trip — we&apos;ll automate a fully-personalised draft in seconds.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={onNew}
            disabled={creating}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-60"
            style={{ background: "#1b3a2d", color: "white" }}
          >
            {creating ? "Creating…" : "+ New proposal"}
          </button>
          <Link
            href="/import"
            className="px-5 py-2.5 rounded-xl border text-sm font-medium active:scale-95 transition"
            style={{ borderColor: "rgba(201,168,76,0.6)", background: "rgba(201,168,76,0.08)", color: "#8a7125" }}
            title="Import an existing proposal from Safariportal, Safari Office, Wetu — or any PDF"
          >
            Import existing →
          </Link>
          <button
            onClick={onImportSample}
            disabled={importing}
            className="px-5 py-2.5 rounded-xl border border-black/12 text-black/60 text-sm font-medium hover:bg-black/5 active:scale-95 transition disabled:opacity-60"
            title="Load a pre-filled demo proposal for exploration only — not a real trip"
          >
            {importing ? "Loading…" : "Try demo"}
          </button>
        </div>
      </div>
    );
  }

  const open = () => {
    try { localStorage.setItem("activeProposalId", proposal.id); } catch {}
    router.push("/studio");
  };
  const share = async () => {
    try { localStorage.setItem("activeProposalId", proposal.id); } catch {}
    const url = `${window.location.origin}/p/${proposal.id}`;
    try { await navigator.clipboard.writeText(url); } catch {}
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden text-white relative"
      style={{
        background: "linear-gradient(135deg, #1b3a2d 0%, #142a20 100%)",
        borderColor: "rgba(201,168,76,0.18)",
      }}
    >
      {/* Texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #c9a84c 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative px-7 py-7 md:px-9 md:py-8 flex items-center gap-6 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#c9a84c]">
            Active proposal
          </div>
          <h2
            className="mt-2 text-2xl md:text-3xl font-bold tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {proposal.title || "Untitled Proposal"}
          </h2>
          <div className="mt-2 text-[13px] text-white/55">
            {proposal.clientName ? `${proposal.clientName} · ` : ""}
            Edited {formatRelative(proposal.updatedAt)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={share}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95 hover:brightness-110"
            style={{ background: "#c9a84c", color: "#1b3a2d" }}
          >
            Share
          </button>
          <button
            onClick={open}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white/20 hover:bg-white/[0.06] transition"
          >
            Continue editing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Snapshot cards ─────────────────────────────────────────────────────────

function QuickActionsCard({
  onNew,
  creating,
  onImportSample,
  importing,
  hasProposals,
}: {
  onNew: () => void;
  creating: boolean;
  onImportSample: () => void;
  importing: boolean;
  hasProposals: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white border border-black/8 p-5 flex flex-col">
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40 mb-3">
        Quick actions
      </div>
      <h3 className="text-[15px] font-semibold text-black/85 mb-4">
        Start something new
      </h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={onNew}
          disabled={creating}
          className="px-4 py-2.5 rounded-xl bg-[#1b3a2d] text-white text-sm font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-60 text-left"
        >
          {creating ? "Creating…" : "+ New proposal"}
        </button>
        <Link
          href="/import"
          className="px-4 py-2.5 rounded-xl border text-sm font-medium transition active:scale-95"
          style={{ borderColor: "rgba(201,168,76,0.6)", background: "rgba(201,168,76,0.08)", color: "#8a7125" }}
          title="Bring a PDF from Safariportal / Safari Office / Wetu"
        >
          Import existing proposal →
        </Link>
        <Link
          href="/properties/new"
          className="px-4 py-2.5 rounded-xl border border-black/12 text-black/70 text-sm font-medium hover:bg-black/5 transition active:scale-95"
        >
          + Add property
        </Link>
        <button
          onClick={onImportSample}
          disabled={importing}
          className="px-4 py-2.5 rounded-xl border border-black/12 text-black/70 text-sm font-medium hover:bg-black/5 active:scale-95 transition disabled:opacity-60 text-left"
          title="Load a pre-filled demo proposal for exploration only — not a real trip"
        >
          {importing ? "Loading…" : "Try demo proposal"}
        </button>
      </div>
    </div>
  );
}

// ─── Subtle safari backdrop ─────────────────────────────────────────────────
//
// CSS-only ambience. No imagery dependency. Two heavily-blurred forest blobs
// (top-right + bottom-left) plus a faint gold dot pattern. Sits at z-0 with
// pointer-events: none so it never interferes with content.

function DashboardBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Top-right forest halo */}
      <div
        className="absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full opacity-[0.08]"
        style={{
          background: "radial-gradient(circle, #1b3a2d 0%, transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      {/* Bottom-left gold halo — softer */}
      <div
        className="absolute -bottom-60 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.07]"
        style={{
          background: "radial-gradient(circle, #c9a84c 0%, transparent 60%)",
          filter: "blur(50px)",
        }}
      />
      {/* Faint gold dot pattern across the page */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #1b3a2d 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}

function PropertiesCard({
  count,
  locations,
  recent,
}: {
  count: number | null;
  locations: number | null;
  recent: PropertyRow[];
}) {
  return (
    <Link
      href="/properties"
      className="group rounded-2xl bg-white border border-black/8 p-5 flex flex-col hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition"
    >
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40 mb-3">
        Properties
      </div>
      <div className="flex items-baseline gap-3">
        <div className="text-3xl font-bold text-black/85 tabular-nums">
          {count ?? "—"}
        </div>
        <div className="text-[12px] text-black/45">
          across {locations ?? 0} location{locations === 1 ? "" : "s"}
        </div>
      </div>
      {recent.length > 0 ? (
        <div className="mt-4 flex -space-x-2">
          {recent.map((p) => (
            <div
              key={p.id}
              className="w-10 h-10 rounded-lg border-2 border-white bg-black/5 overflow-hidden shrink-0"
              title={p.name}
            >
              {p.images[0]?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-black/40">
          Build the library that powers every proposal.
        </p>
      )}
      <div className="mt-auto pt-4 text-[13px] text-black/50 group-hover:text-[#1b3a2d] transition">
        Open library →
      </div>
    </Link>
  );
}

function BrandDNACard({ completion }: { completion: BrandDNACompletion | null }) {
  if (!completion) {
    return (
      <Link
        href="/settings/brand"
        className="group rounded-2xl bg-white border border-black/8 p-5 flex flex-col hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition"
      >
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40 mb-3">
          Brand DNA
        </div>
        <div className="text-[15px] font-semibold text-black/85">Set up your brand voice</div>
        <p className="mt-1 text-[12px] text-black/45">
          Optional but recommended — sharpens every proposal.
        </p>
        <div className="mt-auto pt-4 text-[13px] text-black/50 group-hover:text-[#1b3a2d] transition">
          Open Brand DNA →
        </div>
      </Link>
    );
  }
  const { overall, nextBestAction } = completion;
  return (
    <Link
      href="/settings/brand"
      className="group rounded-2xl bg-white border border-black/8 p-5 flex flex-col hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition"
    >
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40 mb-3">
        Brand DNA
      </div>
      <div className="flex items-center gap-4">
        <CompletionRing percent={overall} size={56} stroke={5} />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-black/85">
            {overall === 100 ? "Dialed in." : `${overall}% complete`}
          </div>
          <div className="text-[12px] text-black/50 mt-0.5 line-clamp-2">
            {nextBestAction?.headline ?? "Your voice is anchored."}
          </div>
        </div>
      </div>
      <div className="mt-auto pt-4 text-[13px] text-black/50 group-hover:text-[#1b3a2d] transition">
        Open Brand DNA →
      </div>
    </Link>
  );
}

// ─── Utils ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
