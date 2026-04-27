"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  OrganizationSwitcher,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { BrandDNADashboardCard } from "@/components/brand-dna/BrandDNADashboardCard";
import { TripSetupDialog, type TripSetupResult } from "@/components/trip-setup/TripSetupDialog";
import { mergeAutopilotIntoProposal, type AutopilotResult } from "@/lib/autopilotMerge";
import { applyIdentityToOperator, identityFromMe, type ConsultantIdentity } from "@/lib/consultantIdentity";

type ProposalSummary = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  clientName: string | null;
};

type LoadState = "loading" | "ready" | "error";

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProposalSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tripSetupOpen, setTripSetupOpen] = useState(false);
  const [identity, setIdentity] = useState<ConsultantIdentity | null>(null);

  // Load the current user's identity once so we can stamp it onto new
  // proposals before POSTing. Keeps per-user name/photo/signature on
  // every draft this user creates, regardless of org defaults.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const me = await res.json();
        if (!cancelled && me?.user) setIdentity(identityFromMe(me));
      } catch {
        // best-effort — identity stamp is a nice-to-have, not required
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/proposals", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in?redirect_url=/proposals"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProposals(Array.isArray(data.proposals) ? data.proposals : []);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Proposal creation always runs through Trip Setup so the AI has the facts
  // it needs to draft a personalised proposal. The in-line handler below
  // mirrors the dashboard's flow: save blank → autopilot → merge → /studio.
  const handleNew = () => {
    if (creating) return;
    setTripSetupOpen(true);
  };

  // Abort-controller for the in-flight autopilot. Powers the Cancel
  // button on the AutomatingOverlay so the user can abandon a long
  // draft and return to the form with their inputs intact.
  const submitAbortRef = useRef<AbortController | null>(null);

  const handleTripSetupSubmit = async ({ proposal, autopilot }: TripSetupResult) => {
    if (creating) return;
    setCreating(true);
    const controller = new AbortController();
    submitAbortRef.current = controller;

    // Stamp consultant identity (name / photo / signature / role) onto
    // the operator block before save. Only fills empty fields so a
    // manually-customised operator block survives.
    if (identity) {
      proposal.operator = applyIdentityToOperator(proposal.operator, identity);
    }

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
        signal: controller.signal,
      });
      if (res.status === 401) { window.location.href = "/sign-in?redirect_url=/proposals"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
            // Honest signal: if the AI returned no days at all, the
            // editor will open with a blank proposal — surface that
            // instead of silently saving an empty merge.
            if (!draft.days || draft.days.length === 0) {
              setError(
                "AI generated no days for this trip. The editor will open with your blank proposal — try the Regenerate button inside, or fill the days manually.",
              );
            } else {
              const merged = mergeAutopilotIntoProposal(proposal, draft);
              // Persist the merged result. If this save fails the editor
              // would open with the blank first-save and the operator
              // would see "nothing populated" with no clue why — usually
              // because the merged JSON exceeded a body limit. Surface
              // status + reason and stop the redirect so they can react.
              const saveBody = JSON.stringify({ proposal: merged });
              const save = await fetch("/api/proposals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: saveBody,
                signal: controller.signal,
              });
              if (!save.ok) {
                const detail = await save.json().catch(() => ({}));
                const reason = detail?.error || `HTTP ${save.status}`;
                console.error(
                  "[autopilot] merge save failed:",
                  save.status,
                  reason,
                  "· payload bytes:",
                  saveBody.length,
                );
                setError(
                  `AI drafted the proposal but couldn't save it (${reason}). ${
                    saveBody.length > 3_000_000
                      ? "The payload is unusually large — you may have inline base64 images on properties; re-uploading them through Supabase Storage will fix this."
                      : "Open the editor and use the Regenerate button to retry."
                  }`,
                );
                // Don't redirect — keep operator on the dialog so they
                // can read the error. Their inputs survive.
                return;
              }
            }
          } else {
            // Surface the server's error reason rather than swallowing.
            // Operators were seeing "I hit Generate but nothing
            // appeared" with no clue why — usually a 500 (missing
            // ANTHROPIC_API_KEY) or a 502 (model output didn't parse).
            const body = await ai.json().catch(() => ({}));
            const reason = body?.error || `HTTP ${ai.status}`;
            setError(`AI couldn't draft this proposal: ${reason}. The editor will open with your blank proposal — try the Regenerate button inside.`);
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          console.warn("[autopilot] soft-fail; opening editor anyway:", err);
          setError(
            "AI couldn't reach the server. The editor will open with your blank proposal — check your connection and try Regenerate inside the editor.",
          );
        }
      }

      // Only commit to opening the proposal if we weren't cancelled.
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

  const handleOpen = (id: string) => {
    try { localStorage.setItem("activeProposalId", id); } catch {}
    router.push("/studio");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proposals/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      try {
        if (localStorage.getItem("activeProposalId") === deleteTarget.id) {
          localStorage.removeItem("activeProposalId");
        }
      } catch {}
      setProposals((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#1a1a1a]">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-black/10 bg-white flex items-center justify-between px-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c9a84c] font-bold text-base"
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            S
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-black/80 group-hover:text-black transition">
            Safari Studio
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/proposals"
            afterCreateOrganizationUrl="/proposals"
            afterLeaveOrganizationUrl="/select-organization"
            appearance={{
              elements: {
                organizationSwitcherTrigger: {
                  padding: "4px 10px",
                  borderRadius: "0.5rem",
                  fontSize: "13px",
                  maxWidth: "220px",
                },
                organizationSwitcherPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
                organizationSwitcherPopoverRootBox: { zIndex: 9999 },
              },
            }}
          />
          <DashboardUserSlot />
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black/85">
              Your proposals
            </h1>
            <p className="mt-2 text-black/50 text-[15px]">
              Drafts, in-flight, and sent. Newest first.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/import"
              className="px-4 py-2.5 rounded-xl border text-sm font-medium active:scale-95 transition"
              style={{ borderColor: "rgba(201,168,76,0.6)", background: "rgba(201,168,76,0.08)", color: "#8a7125" }}
              title="Bring a proposal from Safariportal, Safari Office, Wetu — or any PDF"
            >
              Import →
            </Link>
            <button
              onClick={handleNew}
              disabled={creating}
              className="px-5 py-2.5 rounded-xl bg-[#1b3a2d] text-white text-sm font-semibold hover:bg-[#2d5a40] active:scale-95 transition shadow-sm disabled:opacity-60"
            >
              {creating ? "Creating…" : "+ New proposal"}
            </button>
          </div>
        </div>

        <div className="mb-8">
          <BrandDNADashboardCard />
        </div>

        {state === "loading" && <ProposalsSkeleton />}

        {state === "error" && (
          <div className="rounded-2xl border border-[#b34334]/30 bg-[#b34334]/5 p-6 text-[#b34334]">
            <div className="font-semibold mb-1">Couldn&apos;t load proposals</div>
            <div className="text-sm text-[#b34334]/85 break-words">{error}</div>
            <button
              onClick={load}
              className="mt-4 px-4 py-2 rounded-lg border border-[#b34334]/40 text-sm hover:bg-[#b34334]/10 transition"
            >
              Retry
            </button>
          </div>
        )}

        {state === "ready" && proposals.length === 0 && (
          <EmptyState onNew={handleNew} creating={creating} />
        )}

        {state === "ready" && proposals.length > 0 && (
          <div className="bg-white rounded-2xl border border-black/8 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ul className="divide-y divide-black/8">
              {proposals.map((p) => (
                <li key={p.id} className="group">
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-black/[0.02] transition">
                    {/* Title + client */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleOpen(p.id)}
                          className="font-semibold text-[15px] text-black/85 truncate text-left hover:text-[#1b3a2d] transition"
                        >
                          {p.title || "Untitled Proposal"}
                        </button>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[13px] text-black/45">
                        {p.clientName && (
                          <>
                            <span className="truncate">{p.clientName}</span>
                            <span>·</span>
                          </>
                        )}
                        <span className="whitespace-nowrap">
                          Edited {formatRelative(p.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpen(p.id)}
                        className="px-3.5 py-1.5 text-sm rounded-lg border border-black/12 text-black/70 hover:bg-black/5 transition active:scale-95"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="px-3 py-1.5 text-sm rounded-lg text-black/40 hover:text-[#b34334] hover:bg-[#b34334]/5 transition active:scale-95"
                        title="Delete proposal"
                        aria-label={`Delete ${p.title || "proposal"}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
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

      {/* ── Delete confirm modal ────────────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 ss-fade-in"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 ss-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-black/85">Delete this proposal?</h2>
            <p className="mt-2 text-sm text-black/55 break-words">
              &ldquo;{deleteTarget.title || "Untitled Proposal"}&rdquo; will be removed
              permanently. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg text-black/60 hover:bg-black/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-[#b34334] text-white font-medium hover:bg-[#c4543f] transition disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function ProposalsSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <ul className="divide-y divide-black/8">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 bg-black/8 rounded w-1/3 animate-pulse" />
              <div className="h-3 bg-black/6 rounded w-1/4 animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-black/8 rounded-lg animate-pulse" />
            <div className="h-8 w-14 bg-black/6 rounded-lg animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ onNew, creating }: { onNew: () => void; creating: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-black/15 p-14 text-center">
      <div
        className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-[#c9a84c] text-xl font-bold mb-4"
        style={{ background: "rgba(201,168,76,0.15)" }}
      >
        S
      </div>
      <h2 className="text-lg font-semibold text-black/80">No proposals yet</h2>
      <p className="mt-1.5 text-[14px] text-black/50 max-w-sm mx-auto">
        Start fresh in the editor, or bring your last proposal from
        Safariportal / Safari Office / Wetu — we&apos;ll restructure it.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2.5 flex-wrap">
        <button
          onClick={onNew}
          disabled={creating}
          className="px-5 py-2.5 rounded-xl bg-[#1b3a2d] text-white text-sm font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-60"
        >
          {creating ? "Creating…" : "+ New proposal"}
        </button>
        <Link
          href="/import"
          className="px-5 py-2.5 rounded-xl border text-sm font-medium active:scale-95 transition"
          style={{ borderColor: "rgba(201,168,76,0.6)", background: "rgba(201,168,76,0.08)", color: "#8a7125" }}
        >
          Import existing →
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "rgba(0,0,0,0.06)", text: "rgba(0,0,0,0.55)", label: "Draft" },
    sent: { bg: "rgba(201,168,76,0.18)", text: "#8a7125", label: "Sent" },
    accepted: { bg: "rgba(45,90,64,0.15)", text: "#1b3a2d", label: "Accepted" },
  };
  const s = styles[status] ?? styles.draft;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function DashboardUserSlot() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) {
    return <div className="w-8 h-8 rounded-full bg-black/10 animate-pulse" />;
  }
  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className="px-3 py-1.5 text-sm rounded-lg border border-black/12 text-black/70 hover:bg-black/5 transition"
      >
        Sign in
      </Link>
    );
  }
  const initials = (
    (user?.firstName?.[0] ?? "") +
    (user?.lastName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "")
  ).toUpperCase();
  return (
    <div className="relative w-8 h-8">
      <SignOutButton redirectUrl="/">
        <button
          type="button"
          className="absolute inset-0 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-[#1b3a2d] hover:bg-[#2d5a40] transition"
          title="Sign out"
          aria-label="Sign out"
        >
          {initials || "•"}
        </button>
      </SignOutButton>
      <div className="absolute inset-0">
        <UserButton
          appearance={{
            elements: {
              rootBox: { width: "2rem", height: "2rem" },
              avatarBox: { width: "2rem", height: "2rem" },
              userButtonPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
              userButtonPopoverRootBox: { zIndex: 9999 },
              userButtonPopoverMain: { zIndex: 9999 },
            },
          }}
        />
      </div>
    </div>
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
