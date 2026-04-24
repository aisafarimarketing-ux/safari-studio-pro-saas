"use client";

import { useEffect, useRef, useState } from "react";
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
  createdAt?: string;
  clientName: string | null;
};
type LocationLite = { id: string; name: string; country: string | null };
type PropertyRow = {
  id: string;
  name: string;
  location: LocationLite | null;
  images: { id: string; url: string }[];
};
type RequestRow = {
  id: string;
  referenceNumber: string | null;
  status: string;
  source: string | null;
  receivedAt: string;
  client: {
    name: string | null;
    email: string | null;
    country: string | null;
  } | null;
};

export function DashboardWorkspace() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [proposals, setProposals] = useState<ProposalRow[] | null>(null);
  const [properties, setProperties] = useState<PropertyRow[] | null>(null);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [completion, setCompletion] = useState<BrandDNACompletion | null>(null);
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tripSetupOpen, setTripSetupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [propRes, propertyRes, locRes, brandRes, reqRes] = await Promise.all([
          fetch("/api/proposals", { cache: "no-store" }),
          fetch("/api/properties", { cache: "no-store" }),
          fetch("/api/locations", { cache: "no-store" }),
          fetch("/api/brand-dna", { cache: "no-store" }),
          // Open-stage requests only, capped — this feeds the inbox tile.
          fetch("/api/requests?limit=20", { cache: "no-store" }),
        ]);
        if (propRes.status === 401) { window.location.href = "/sign-in?redirect_url=/dashboard"; return; }
        if (propRes.status === 409) { window.location.href = "/select-organization"; return; }
        if (propRes.status === 402) { window.location.href = "/account-suspended"; return; }

        const propData = propRes.ok ? await propRes.json() : { proposals: [] };
        const propertyData = propertyRes.ok ? await propertyRes.json() : { properties: [] };
        const locData = locRes.ok ? await locRes.json() : { locations: [] };
        const brandData = brandRes.ok ? await brandRes.json() : null;
        const reqData = reqRes.ok ? await reqRes.json() : { requests: [] };

        setProposals(propData.proposals ?? []);
        setProperties(propertyData.properties ?? []);
        setLocationCount((locData.locations ?? []).length);
        setCompletion(brandData?.completion ?? null);
        setRequests(reqData.requests ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace");
      }
    })();
  }, []);

  // New proposal now runs through Trip Setup — a fast structured entry flow.
  // Click "+ New proposal" → modal opens → submit builds a configured
  // proposal and POSTs it, then routes to /studio.
  const openNewProposal = () => setTripSetupOpen(true);

  // Abort-controller for the in-flight autopilot request. Lets the user
  // cancel mid-draft and return to the form — see handleCancelSubmit.
  const submitAbortRef = useRef<AbortController | null>(null);

  const handleTripSetupSubmit = async ({ proposal, autopilot }: TripSetupResult) => {
    if (creating) return;
    setCreating(true);
    const controller = new AbortController();
    submitAbortRef.current = controller;

    try {
      // 1. Always save the blank-but-configured proposal first. If
      //    autopilot later fails (or is cancelled) the operator still has
      //    their Trip Setup data safely persisted.
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
        signal: controller.signal,
      });
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 2. Optional AI draft — cancellable via the shared AbortController.
      //    Soft-fails: if the model errors out, we still open the editor
      //    with the blank-but-configured proposal. On cancel we bail
      //    without navigating so the user stays on the Trip Setup form.
      if (autopilot) {
        try {
          const ai = await fetch("/api/ai/autopilot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proposal }),
            signal: controller.signal,
          });
          if (ai.ok) {
            const draft = (await ai.json()) as AutopilotResult;
            const merged = mergeAutopilotIntoProposal(proposal, draft);
            await fetch("/api/proposals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ proposal: merged }),
              signal: controller.signal,
            });
          } else {
            console.warn("[autopilot] non-OK:", ai.status);
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            // User cancelled — leave the blank proposal in the DB as a
            // harmless draft and return control to the form.
            return;
          }
          console.warn("[autopilot] failed; opening blank editor instead:", err);
        }
      }

      // Only set activeProposalId + navigate once we've committed to
      // opening this proposal. Earlier writes would leave a stale
      // pointer if the user cancelled.
      if (!controller.signal.aborted) {
        try { localStorage.setItem("activeProposalId", proposal.id); } catch {}
        setTripSetupOpen(false);
        router.push(`/studio/${proposal.id}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Could not create proposal");
    } finally {
      if (submitAbortRef.current === controller) submitAbortRef.current = null;
      setCreating(false);
    }
  };

  const handleCancelSubmit = () => {
    submitAbortRef.current?.abort();
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

        {/* Empty state — full-width CTA card when the workspace has no
            proposals yet. Otherwise we fall into the tile grid below. */}
        {proposals !== null && proposals.length === 0 && (
          <ActiveProposalCard
            loaded
            proposal={null}
            onNew={openNewProposal}
            creating={creating}
            onImportSample={handleImportSample}
            importing={importing}
          />
        )}

        {proposals !== null && proposals.length > 0 && (
          <>
            {/* ── Today ─────────────────────────────────────────────────
                Three tiles: the active proposal, the open-requests inbox,
                and a this-month stats snapshot. Anchored at the top so
                the operator sees the day's signal first. */}
            <section className="mb-8">
              <SectionTitle>Today</SectionTitle>
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ActiveProposalTile proposal={activeProposal} />
                <InboxTile requests={requests} />
                <MonthStatsTile proposals={proposals} requests={requests} />
              </div>
            </section>

            {/* ── Start something (action bar) ─────────────────────────
                Persistent launchpad — new proposal, import from SP / SO /
                Wetu, browse templates, add a property. */}
            <section className="mb-8">
              <SectionTitle>Start something</SectionTitle>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <ActionTile
                  onClick={openNewProposal}
                  disabled={creating}
                  title={creating ? "Creating…" : "New proposal"}
                  hint="Trip setup + AI autopilot"
                  accent
                />
                <ActionTile
                  href="/import"
                  title="Import existing"
                  hint="Bring a PDF from Safariportal, Wetu…"
                  gold
                />
                <ActionTile
                  href="/templates"
                  title="Browse templates"
                  hint="20 proven East-Africa shapes"
                />
                <ActionTile
                  href="/properties/new"
                  title="Add property"
                  hint="Grow your camp library"
                />
              </div>
            </section>

            {/* ── Your workspace ──────────────────────────────────────
                Property library snapshot, brand DNA ring, templates
                (placeholder until Step 6 ships). */}
            <section className="mb-8">
              <SectionTitle>Your workspace</SectionTitle>
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <PropertiesCard
                  count={propertyCount}
                  locations={locationCount}
                  recent={properties?.slice(0, 3) ?? []}
                />
                <BrandDNACard completion={completion} />
                <TemplatesTile />
              </div>
            </section>

            {/* ── Recent proposals ───────────────────────────────────── */}
            {recentProposals.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <SectionTitle>Recent proposals</SectionTitle>
                  <Link
                    href="/proposals"
                    className="text-[12.5px] text-black/45 hover:text-[#1b3a2d] transition"
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
          </>
        )}
      </main>

      {tripSetupOpen && (
        <TripSetupDialog
          onClose={() => { if (!creating) setTripSetupOpen(false); }}
          onCancel={handleCancelSubmit}
          onSubmit={handleTripSetupSubmit}
          submitting={creating}
        />
      )}
    </div>
  );
}

// ─── Active proposal card ───────────────────────────────────────────────────

// Empty-state hero. Rendered only when proposals[] is an empty array —
// first-time operators land here. Once they have a proposal, the Today
// row takes over (ActiveProposalTile + InboxTile + MonthStatsTile) and
// this card disappears.
function ActiveProposalCard({
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

// ─── Snapshot cards ─────────────────────────────────────────────────────────

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

// ─── Section header ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/45">
      {children}
    </h2>
  );
}

// ─── Active proposal tile (compact, 1-col) ─────────────────────────────────

function ActiveProposalTile({ proposal }: { proposal: ProposalRow | null }) {
  const router = useRouter();
  if (!proposal) {
    return (
      <div className="rounded-2xl border border-black/8 bg-white p-5 flex flex-col">
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40 mb-3">
          Active proposal
        </div>
        <div className="text-[14px] text-black/55">No proposal open yet.</div>
      </div>
    );
  }
  const open = () => {
    try { localStorage.setItem("activeProposalId", proposal.id); } catch {}
    router.push("/studio");
  };
  const copyShare = async () => {
    const url = `${window.location.origin}/p/${proposal.id}`;
    try { await navigator.clipboard.writeText(url); } catch {}
  };
  return (
    <div
      className="rounded-2xl border overflow-hidden text-white relative flex flex-col"
      style={{
        background: "linear-gradient(135deg, #1b3a2d 0%, #142a20 100%)",
        borderColor: "rgba(201,168,76,0.22)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #c9a84c 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative p-5 flex-1 flex flex-col">
        <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[#c9a84c]">
          Active proposal
        </div>
        <h3
          className="mt-2 text-lg font-bold tracking-tight leading-snug line-clamp-2"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {proposal.title || "Untitled Proposal"}
        </h3>
        <div className="mt-1.5 text-[12px] text-white/55 truncate">
          {proposal.clientName ? `${proposal.clientName} · ` : ""}
          Edited {formatRelative(proposal.updatedAt)}
        </div>
        <div className="mt-auto pt-4 flex items-center gap-2">
          <button
            onClick={open}
            className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold transition active:scale-95 hover:brightness-110"
            style={{ background: "#c9a84c", color: "#1b3a2d" }}
          >
            Open
          </button>
          <button
            onClick={copyShare}
            className="px-3 py-2 rounded-lg text-[13px] font-semibold text-white border border-white/20 hover:bg-white/[0.06] transition"
            title="Copy the public share link"
          >
            Share link
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inbox tile (top open requests) ────────────────────────────────────────

function InboxTile({ requests }: { requests: RequestRow[] | null }) {
  const loaded = requests !== null;
  const top = (requests ?? []).slice(0, 3);
  const openCount = (requests ?? []).length;
  return (
    <Link
      href="/requests"
      className="group rounded-2xl border border-black/8 bg-white p-5 flex flex-col hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition"
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-black/40">
          Inbox
        </div>
        {loaded && openCount > 0 && (
          <div className="text-[11px] font-semibold text-[#1b3a2d] tabular-nums">
            {openCount} open
          </div>
        )}
      </div>

      {!loaded ? (
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-black/5 rounded animate-pulse" />
          <div className="h-4 bg-black/5 rounded animate-pulse w-4/5" />
          <div className="h-4 bg-black/5 rounded animate-pulse w-3/5" />
        </div>
      ) : top.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center text-[13px] text-black/50">
          <div>No open requests.</div>
          <div className="text-[12px] text-black/40 mt-1">
            New client enquiries show up here.
          </div>
        </div>
      ) : (
        <ul className="flex-1 space-y-2.5">
          {top.map((r) => (
            <li key={r.id} className="flex items-baseline gap-2">
              <div className="text-[10.5px] font-mono text-black/35 shrink-0 tabular-nums">
                {r.referenceNumber ?? "—"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-black/80 truncate">
                  {r.client?.name || r.client?.email || "Unknown"}
                </div>
                <div className="text-[11px] text-black/45 truncate">
                  {r.source ? `${r.source} · ` : ""}
                  {formatRelative(r.receivedAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-[13px] text-black/50 group-hover:text-[#1b3a2d] transition">
        Open inbox →
      </div>
    </Link>
  );
}

// ─── This-month stats tile ─────────────────────────────────────────────────

function MonthStatsTile({
  proposals,
  requests,
}: {
  proposals: ProposalRow[] | null;
  requests: RequestRow[] | null;
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = now.toLocaleDateString(undefined, { month: "long" });

  const proposalsThisMonth = (proposals ?? []).filter((p) => {
    const d = new Date(p.updatedAt);
    return d >= monthStart;
  }).length;

  const requestsThisMonth = (requests ?? []).filter((r) => {
    const d = new Date(r.receivedAt);
    return d >= monthStart;
  }).length;

  return (
    <Link
      href="/analytics"
      className="group rounded-2xl border border-black/8 bg-white p-5 flex flex-col hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition"
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-black/40">
          This month
        </div>
        <div className="text-[10.5px] tracking-wider text-black/35 uppercase">{monthLabel}</div>
      </div>

      <div className="flex-1 flex flex-col gap-3 justify-center">
        <StatRow label="Proposals edited" value={proposalsThisMonth} />
        <StatRow label="New requests" value={requestsThisMonth} />
      </div>

      <div className="mt-4 text-[13px] text-black/50 group-hover:text-[#1b3a2d] transition">
        View analytics →
      </div>
    </Link>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <div
        className="text-3xl font-bold tabular-nums text-[#1b3a2d] min-w-[3ch] text-right"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </div>
      <div className="text-[13px] text-black/60">{label}</div>
    </div>
  );
}

// ─── Action tile (launchpad buttons) ───────────────────────────────────────

function ActionTile({
  onClick,
  href,
  disabled,
  title,
  hint,
  accent,
  gold,
}: {
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title: string;
  hint: string;
  accent?: boolean;
  gold?: boolean;
}) {
  const bodyCls = `group rounded-xl border p-4 flex flex-col h-full transition active:scale-[0.98] ${
    accent
      ? "text-white border-transparent"
      : gold
        ? "border-transparent"
        : "bg-white border-black/8 hover:border-black/20"
  }`;
  const accentStyle: React.CSSProperties = accent
    ? { background: "#1b3a2d" }
    : gold
      ? { background: "rgba(201,168,76,0.1)", borderColor: "rgba(201,168,76,0.55)" }
      : {};

  const inner = (
    <>
      <div
        className={`text-[14px] font-semibold leading-tight ${
          accent ? "text-white" : gold ? "text-[#8a7125]" : "text-black/85"
        }`}
      >
        {title}
      </div>
      <div
        className={`mt-1 text-[11.5px] leading-snug ${
          accent ? "text-white/65" : gold ? "text-[#8a7125]/75" : "text-black/50"
        }`}
      >
        {hint}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={bodyCls} style={accentStyle}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${bodyCls} text-left disabled:opacity-60 disabled:cursor-not-allowed`}
      style={accentStyle}
    >
      {inner}
    </button>
  );
}

// ─── Templates placeholder tile ────────────────────────────────────────────
// Real /templates page arrives in Step 6; for now this link lands on a
// 404 which we accept for the duration of the redesign → templates arc.

function TemplatesTile() {
  return (
    <Link
      href="/templates"
      className="group rounded-2xl border border-black/8 bg-white p-5 flex flex-col hover:border-black/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition"
    >
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-black/40 mb-3">
        Templates
      </div>
      <div className="text-[15px] font-semibold text-black/85">Proven shapes</div>
      <p className="mt-1 text-[12px] text-black/45 leading-relaxed">
        20 Kenya + Tanzania starting points. Clone one, customise everything — keep the voice yours.
      </p>
      <div className="mt-auto pt-4 text-[13px] text-black/50 group-hover:text-[#1b3a2d] transition">
        Browse →
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
