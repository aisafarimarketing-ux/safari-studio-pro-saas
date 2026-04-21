"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/properties/AppHeader";
import { SignaturePad } from "@/components/editor/SignaturePad";
import { uploadImage } from "@/lib/uploadImage";

// Settings → Your profile
//
// Per-user per-org fields: profile photo, role title ("Founder / Safari
// Specialist"), personal signature, email notification prefs.
// All stored on OrgMembership so a user who belongs to multiple orgs
// can present differently in each.

type Member = {
  userId: string;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  roleTitle: string | null;
  profilePhotoUrl: string | null;
  signatureUrl?: string | null;
  notificationPrefs?: { newRequest?: boolean; requestAssigned?: boolean } | null;
};

type NotificationPrefs = { newRequest: boolean; requestAssigned: boolean };

export function ProfileSettingsPage() {
  const [me, setMe] = useState<Member | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>({ newRequest: true, requestAssigned: true });

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [padOpen, setPadOpen] = useState(false);

  // Load my membership via /api/me (private fields included).
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        user: { id: string; name: string | null; email: string | null };
        membership: {
          roleTitle: string | null;
          profilePhotoUrl: string | null;
          signatureUrl: string | null;
          notificationPrefs: { newRequest?: boolean; requestAssigned?: boolean } | null;
        } | null;
        role: "owner" | "admin" | "member";
      };
      setMyUserId(data.user.id);
      const m: Member = {
        userId: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.role,
        roleTitle: data.membership?.roleTitle ?? null,
        profilePhotoUrl: data.membership?.profilePhotoUrl ?? null,
        signatureUrl: data.membership?.signatureUrl ?? null,
        notificationPrefs: data.membership?.notificationPrefs ?? null,
      };
      setMe(m);
      setRoleTitle(m.roleTitle ?? "");
      setPhotoUrl(m.profilePhotoUrl ?? null);
      setSignatureUrl(m.signatureUrl ?? null);
      const n = m.notificationPrefs ?? null;
      setPrefs({
        newRequest: n?.newRequest ?? true,
        requestAssigned: n?.requestAssigned ?? true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (patch: Record<string, unknown>) => {
    if (!myUserId) return;
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/team/${myUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  // Profile photo upload — routes through our normal uploadImage helper
  // so it ends up on Supabase Storage.
  const handlePhotoPick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const url = await uploadImage(file, { maxDimension: 480 });
        setPhotoUrl(url);
        await patch({ profilePhotoUrl: url });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  if (!me) {
    return (
      <div className="min-h-screen bg-[#f8f5ef]">
        <AppHeader />
        <main className="max-w-3xl mx-auto px-6 py-16">
          {error ? (
            <div className="rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-4 text-[13px] text-[#b34334]">
              {error}
            </div>
          ) : (
            <div className="h-40 rounded-2xl bg-black/5 animate-pulse" />
          )}
        </main>
      </div>
    );
  }

  const displayName = me.name || me.email || "You";
  const initial = (displayName ?? "·").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-6 py-10 md:py-12">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-black/50">Settings</div>
            <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
              Your profile
            </h1>
            <p className="mt-2 text-[14px] text-black/55 max-w-xl">
              How you show up on the team and inside the proposals you send.
            </p>
          </div>
          <Link href="/settings/lead-sources" className="text-[12px] text-black/45 hover:text-[#1b3a2d]">
            Lead sources →
          </Link>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-3 text-[13px] text-[#b34334]">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-5 rounded-xl border border-[#1b3a2d]/25 bg-[#1b3a2d]/5 p-3 text-[13px] text-[#1b3a2d]">
            Saved.
          </div>
        )}

        {/* Identity card */}
        <section className="bg-white rounded-2xl border border-black/8 p-5 mb-5">
          <div className="flex items-center gap-5">
            <div className="relative">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-[28px] font-semibold"
                  style={{ background: "rgba(201,168,76,0.15)", color: "#8a7228" }}
                >
                  {initial}
                </div>
              )}
              <button
                type="button"
                onClick={handlePhotoPick}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 bg-white border border-black/10 rounded-full text-[10.5px] font-medium px-2 py-0.5 text-black/70 hover:text-[#1b3a2d] shadow-sm disabled:opacity-60"
              >
                {uploading ? "…" : photoUrl ? "Change" : "Upload"}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold text-black/85">{displayName}</div>
              <div className="text-[12.5px] text-black/55">{me.email}</div>
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-black/45 mt-1 font-semibold">
                {me.role}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Label>Role title (how you appear on proposals)</Label>
            <div className="flex items-center gap-2">
              <input
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                onBlur={() => patch({ roleTitle })}
                placeholder="Founder / Safari Specialist"
                className="flex-1 px-3 py-2 rounded border border-black/10 text-[14px] outline-none focus:border-[#1b3a2d]"
              />
            </div>
          </div>
        </section>

        {/* Signature */}
        <section className="bg-white rounded-2xl border border-black/8 p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[13.5px] font-semibold text-black/85">Personal signature</div>
              <div className="text-[12px] text-black/55 mt-0.5">
                Appears under your name in the Personal Note section of every proposal you send.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPadOpen(true)}
              className="text-[12.5px] font-medium text-white px-4 py-1.5 rounded-full"
              style={{ background: "#1b3a2d" }}
            >
              {signatureUrl ? "Replace" : "Sign"}
            </button>
          </div>
          <div className="rounded-lg border border-black/10 bg-[#fafaf7] h-24 flex items-center justify-center">
            {signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureUrl}
                alt="Your signature"
                className="max-h-full max-w-full object-contain"
                style={{ mixBlendMode: "multiply" }}
              />
            ) : (
              <span className="text-[12px] text-black/35">Not signed yet</span>
            )}
          </div>
        </section>

        {/* Notification prefs */}
        <section className="bg-white rounded-2xl border border-black/8 p-5">
          <div className="text-[13.5px] font-semibold text-black/85">Email notifications</div>
          <div className="text-[12px] text-black/55 mt-0.5 mb-4">
            These are personal — they don&apos;t affect other teammates.
          </div>
          <div className="space-y-3">
            <Toggle
              label="Notify me when a new request is received"
              value={prefs.newRequest}
              onChange={(v) => {
                const next = { ...prefs, newRequest: v };
                setPrefs(next);
                patch({ notificationPrefs: next });
              }}
            />
            <Toggle
              label="Notify me when a request has been assigned to me"
              value={prefs.requestAssigned}
              onChange={(v) => {
                const next = { ...prefs, requestAssigned: v };
                setPrefs(next);
                patch({ notificationPrefs: next });
              }}
            />
          </div>
          <div className="mt-4 text-[11px] text-black/45 italic">
            Email delivery is not wired up yet — preferences are stored now so they take effect the moment it ships.
          </div>
        </section>

        {padOpen && (
          <SignaturePad
            initial={signatureUrl ?? null}
            onSave={async (dataUrl) => {
              setSignatureUrl(dataUrl);
              await patch({ signatureUrl: dataUrl });
            }}
            onClose={() => setPadOpen(false)}
          />
        )}
      </main>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.26em] font-semibold text-black/55 mb-2">
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span
        className="relative inline-block w-9 h-5 rounded-full transition"
        style={{ background: value ? "#1b3a2d" : "rgba(0,0,0,0.18)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: value ? "18px" : "2px" }}
        />
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="text-[13px] text-black/75">{label}</span>
    </label>
  );
}
