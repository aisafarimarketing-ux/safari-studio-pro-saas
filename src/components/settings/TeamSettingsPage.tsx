"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OrganizationProfile, useOrganization } from "@clerk/nextjs";
import { AppHeader } from "@/components/properties/AppHeader";

// Team management surface. Two stacked panels:
//
//   1. Pending invitations — our own list backed by /api/team/invitations
//      so the operator can resend/revoke without bouncing to Clerk's
//      hosted dashboard. Surfaces every invite Clerk has on file for
//      the org (status="pending"), regardless of whether the email
//      actually arrived.
//
//   2. Full org profile — Clerk's <OrganizationProfile /> for member
//      list, role assignment, the invite form itself, and Clerk's
//      built-in pending list (we still show it; ours is just faster
//      to act on).

type Invitation = {
  id: string;
  emailAddress: string;
  role: string;
  status: string;
  createdAt: number;
};

export function TeamSettingsPage() {
  const { organization, isLoaded } = useOrganization();
  const [invites, setInvites] = useState<Invitation[] | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Email of the most recently resent invite, plus a timestamp so the
  // confirmation banner can fade out after a few seconds.
  const [lastResent, setLastResent] = useState<{ email: string; at: number } | null>(null);

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/team/invitations", { cache: "no-store" });
      if (res.status === 403) {
        setInvitesError(null);
        setInvites([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { invitations: Invitation[] };
      setInvites(json.invitations);
      setInvitesError(null);
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const handleResend = async (invitationId: string) => {
    if (busyId) return;
    const inviteRecord = invites?.find((inv) => inv.id === invitationId);
    setBusyId(invitationId);
    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      if (inviteRecord) {
        const stamp = Date.now();
        setLastResent({ email: inviteRecord.emailAddress, at: stamp });
        // Auto-fade after a minute so the banner doesn't outstay its
        // welcome. Parent state, so unmount tears it down too.
        setTimeout(() => {
          setLastResent((curr) => (curr && curr.at === stamp ? null : curr));
        }, 60_000);
      }
      await loadInvites();
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (busyId) return;
    if (!confirm("Revoke this pending invitation? The recipient won't be able to use the link.")) return;
    setBusyId(invitationId);
    try {
      const res = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      await loadInvites();
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-6 py-10 md:py-12">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-label ed-label text-[#1b3a2d]">Settings</div>
            <h1 className="mt-2 text-h1 font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
              Team &amp; seats
            </h1>
            <p className="mt-2 text-body text-black/55 max-w-xl">
              Invite teammates, assign roles, and manage pending invitations.
              Operator tier includes up to 5 seats; talk to us if you need more.
            </p>
          </div>
          <Link
            href="/settings/brand"
            className="text-small text-black/45 hover:text-[#1b3a2d] transition"
          >
            Brand DNA →
          </Link>
        </div>

        {!isLoaded ? (
          <div className="h-64 bg-white rounded-2xl border border-black/8 animate-pulse" />
        ) : !organization ? (
          <div className="rounded-2xl border border-[#b34334]/30 bg-[#b34334]/5 p-6 text-[#b34334]">
            <div className="font-semibold">No active organization</div>
            <p className="text-sm mt-1">
              <Link href="/select-organization" className="underline">
                Create or join a workspace
              </Link>{" "}
              before inviting teammates.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <PendingInvitations
              invites={invites}
              error={invitesError}
              busyId={busyId}
              lastResent={lastResent}
              onResend={handleResend}
              onRevoke={handleRevoke}
            />

            <div className="rounded-2xl overflow-hidden bg-white border border-black/8 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
              <OrganizationProfile
                routing="hash"
                appearance={{
                  elements: {
                    rootBox: { width: "100%" },
                    cardBox: { width: "100%", boxShadow: "none" },
                    navbar: { background: "#f7f4ee" },
                    organizationProfilePage: { padding: "24px" },
                  },
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Pending invitations panel ──────────────────────────────────────────

function PendingInvitations({
  invites,
  error,
  busyId,
  lastResent,
  onResend,
  onRevoke,
}: {
  invites: Invitation[] | null;
  error: string | null;
  busyId: string | null;
  lastResent: { email: string; at: number } | null;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  // Banner shows whenever a resend has happened in this session;
  // re-clicking Resend simply replaces it with the latest. Auto-clear
  // is handled by the parent (timeout fired in handleResend).
  const recentResend = lastResent;

  return (
    <section
      className="rounded-2xl bg-white p-6"
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2
            className="text-[18px] font-bold text-black/85"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Pending invitations
          </h2>
          <p className="text-[13px] text-black/55 mt-1 max-w-xl">
            Invite sent. It can take a few minutes to arrive — check spam if
            needed. Didn&rsquo;t receive it? Resend below or re-invite from a
            different email.
          </p>
        </div>
      </div>

      {recentResend && (
        <div
          className="mb-4 rounded-lg p-3 text-[13px]"
          style={{
            background: "rgba(27,58,45,0.06)",
            color: "#1b3a2d",
            border: "1px solid rgba(27,58,45,0.18)",
          }}
        >
          Invite resent to <strong>{recentResend.email}</strong>. It can take a
          few minutes to arrive — check spam if needed.
        </div>
      )}

      {error && (
        <div
          className="mb-4 rounded-lg p-3 text-[13px]"
          style={{
            background: "rgba(179,67,52,0.08)",
            color: "#b34334",
            border: "1px solid rgba(179,67,52,0.22)",
          }}
        >
          {error}
        </div>
      )}

      {invites === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg animate-pulse"
              style={{ background: "rgba(0,0,0,0.04)" }}
            />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <div
          className="py-6 text-center text-[13px]"
          style={{ color: "rgba(0,0,0,0.45)" }}
        >
          No pending invitations. New invites land here until they&rsquo;re accepted.
        </div>
      ) : (
        <ul className="divide-y divide-black/5">
          {invites.map((inv) => (
            <InvitationRow
              key={inv.id}
              invite={inv}
              busy={busyId === inv.id}
              onResend={() => onResend(inv.id)}
              onRevoke={() => onRevoke(inv.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function InvitationRow({
  invite,
  busy,
  onResend,
  onRevoke,
}: {
  invite: Invitation;
  busy: boolean;
  onResend: () => void;
  onRevoke: () => void;
}) {
  const sent = new Date(invite.createdAt);
  const sentLabel = sent.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sent.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  const role = invite.role.replace(/^org:/, "");

  return (
    <li className="flex items-center gap-3 py-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-black/85 truncate">
            {invite.emailAddress}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(27,58,45,0.08)", color: "#1b3a2d" }}
          >
            {role}
          </span>
        </div>
        <div className="text-[11.5px] text-black/45 mt-0.5">
          Sent {sentLabel}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onResend}
          disabled={busy}
          className="px-3 h-8 rounded-md text-[12px] font-semibold transition disabled:opacity-50 active:scale-[0.97]"
          style={{
            background: "#1b3a2d",
            color: "#fff",
          }}
        >
          {busy ? "…" : "Resend"}
        </button>
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="px-3 h-8 rounded-md text-[12px] font-semibold transition disabled:opacity-50 active:scale-[0.97]"
          style={{
            background: "transparent",
            color: "#b34334",
            border: "1px solid rgba(179,67,52,0.32)",
          }}
        >
          Revoke
        </button>
      </div>
    </li>
  );
}
