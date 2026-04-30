"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadImage } from "@/lib/uploadImage";
import { SignaturePad } from "@/components/editor/SignaturePad";

// ─── OnboardingForm ─────────────────────────────────────────────────────
//
// Client component for /onboarding. Hard-gates dashboard access for
// new members until they fill in their consultant identity. All
// fields persist via PATCH /api/team/[myUserId] in a single submit,
// with markOnboarded=true to stamp onboardedAt and lift the gate.

interface InitialValues {
  name: string;
  email: string;
  roleTitle: string;
  whatsapp: string;
  photoUrl: string | null;
  signatureUrl: string | null;
}

export function OnboardingForm({
  myUserId,
  initial,
  orgName,
}: {
  myUserId: string;
  initial: InitialValues;
  orgName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [roleTitle, setRoleTitle] = useState(initial.roleTitle);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photoUrl);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(
    initial.signatureUrl,
  );
  const [padOpen, setPadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Required for submit: name + WhatsApp + photo + signature.
  const canSubmit = !!(
    name.trim().length > 0 &&
    whatsapp.trim().length > 0 &&
    photoUrl &&
    signatureUrl
  );

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/${myUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTitle,
          whatsapp,
          profilePhotoUrl: photoUrl,
          signatureUrl,
          markOnboarded: true,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      // Onboarding complete — redirect to dashboard.
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#1a1a1a] flex items-start md:items-center justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.32em] font-semibold text-black/45 mb-2">
            Welcome to {orgName || "Safari Studio"}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black/85">
            Let&apos;s set up your profile
          </h1>
          <p className="mt-3 text-[14.5px] text-black/55 max-w-md mx-auto">
            These details fill in automatically on every proposal you generate
            — your name, photo, signature, and contact channels.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 md:p-8">
          {/* Photo + signature row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Photo */}
            <div>
              <Label>Profile photo *</Label>
              <div className="flex items-center gap-4">
                <div
                  className="shrink-0 w-20 h-20 rounded-full overflow-hidden border-2 border-black/10 flex items-center justify-center bg-black/5"
                >
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[20px] text-black/40 font-bold">
                      {(name[0] ?? "?").toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 rounded-lg border border-black/10 text-[12.5px] font-medium hover:bg-black/[0.04] transition disabled:opacity-50"
                  >
                    {uploading
                      ? "Uploading…"
                      : photoUrl
                        ? "Replace photo"
                        : "Upload photo"}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhoto(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Signature */}
            <div>
              <Label>Signature *</Label>
              <div className="flex items-center gap-4">
                <div
                  className="shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 border-black/10 flex items-center justify-center bg-black/5"
                >
                  {signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signatureUrl}
                      alt="Signature"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-[10.5px] text-black/40">No sig.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPadOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-black/10 text-[12.5px] font-medium hover:bg-black/[0.04] transition"
                >
                  {signatureUrl ? "Replace" : "Sign"}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-black/8 my-6" />

          {/* Identity inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Display name *</Label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sam Kombe"
                className="w-full px-3 py-2 rounded-lg border border-black/10 text-[14px] outline-none focus:border-[#1b3a2d]"
              />
            </div>
            <div>
              <Label>Role title</Label>
              <input
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Founder · Safari Specialist"
                className="w-full px-3 py-2 rounded-lg border border-black/10 text-[14px] outline-none focus:border-[#1b3a2d]"
              />
            </div>
            <div>
              <Label>WhatsApp number *</Label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+255 712 345 678"
                inputMode="tel"
                className="w-full px-3 py-2 rounded-lg border border-black/10 text-[14px] outline-none focus:border-[#1b3a2d]"
              />
            </div>
            <div>
              <Label>Email</Label>
              <input
                value={initial.email}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-black/10 text-[14px] bg-black/[0.03] text-black/55 outline-none cursor-not-allowed"
              />
              <p className="mt-1 text-[10.5px] text-black/40">
                Managed by your sign-in email. Update it from your account
                settings if needed.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 px-3 py-2 rounded-lg bg-[#b34334]/8 border border-[#b34334]/30 text-[12.5px] text-[#b34334]">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-[11.5px] text-black/45">
              Photo, signature, name and WhatsApp are required.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="px-5 py-2.5 rounded-lg bg-[#1b3a2d] text-white text-[13px] font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : "Continue to dashboard →"}
            </button>
          </div>
        </div>
      </div>

      {padOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPadOpen(false);
          }}
        >
          <SignaturePad
            initial={signatureUrl}
            onSave={(dataUrl) => {
              setSignatureUrl(dataUrl);
              setPadOpen(false);
            }}
            onClose={() => setPadOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-black/55 mb-1.5">
      {children}
    </div>
  );
}
