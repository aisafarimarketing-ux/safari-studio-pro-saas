"use client";

import { useEffect, useState } from "react";

// Two-step New Request form. Step 1 captures the client (the one the
// reference app's Add-New-Request sidebar screenshot shows); step 2
// captures the trip brief + source + handler. Submits as a single POST
// /api/requests; server dedups the client by email.

type LeadSource = { id: string; name: string };
type TeamMember = { userId: string; name: string | null; email: string | null };

export function NewRequestDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — client fields
  const [email, setEmail] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [salutation, setSalutation] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("English");

  // Step 2 — request fields
  const [nights, setNights] = useState("");
  const [travelers, setTravelers] = useState("");
  const [destinations, setDestinations] = useState("");
  const [dates, setDates] = useState("");
  const [style, setStyle] = useState("Mid-range");
  const [source, setSource] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [originalMessage, setOriginalMessage] = useState("");

  // Taxonomies
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load taxonomies once on open ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [sRes, tRes] = await Promise.all([
          fetch("/api/lead-sources", { cache: "no-store" }),
          fetch("/api/team", { cache: "no-store" }),
        ]);
        if (sRes.ok) {
          const d = await sRes.json();
          setSources((d.sources as LeadSource[]) ?? []);
        }
        if (tRes.ok) {
          const d = await tRes.json();
          setTeam((d.team as TeamMember[]) ?? []);
          // Default assignee = the signed-in user.
          if (d.you?.userId) setAssignedTo(d.you.userId);
        }
      } catch {
        // non-fatal — dropdowns fall back to free text
      }
    })();
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────
  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        client: {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          salutation: salutation.trim(),
          country: country.trim(),
          phone: phone.trim(),
          preferredLanguage: language.trim(),
        },
        source: source.trim() || undefined,
        sourceDetail: sourceDetail.trim() || undefined,
        tripBrief: {
          nights: nights ? Number(nights) : undefined,
          travelers: travelers ? Number(travelers) : undefined,
          destinations: destinations
            ? destinations.split(",").map((d) => d.trim()).filter(Boolean)
            : undefined,
          dates: dates.trim() || undefined,
          style: style.trim() || undefined,
          operatorNote: operatorNote.trim() || undefined,
        },
        originalMessage: originalMessage.trim() || undefined,
        assignedToUserId: assignedTo || undefined,
      };
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(30,28,25,0.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl my-12 mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <header className="px-6 py-5 border-b border-black/8 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
            Add New Request<span style={{ color: "#1b3a2d" }}>.</span>
          </h2>
          <button type="button" onClick={onClose} className="text-black/40 hover:text-black/80 text-[18px] leading-none">
            ×
          </button>
        </header>

        {/* Step indicator */}
        <div className="px-6 pt-5">
          <nav className="flex items-center gap-6 text-[13px] border-b border-black/5">
            <StepTab num={1} label="Client Information" active={step === 1} onClick={() => setStep(1)} />
            <StepTab num={2} label="Request Details" active={step === 2} onClick={() => setStep(2)} />
          </nav>
        </div>

        <div className="px-6 py-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-[#b34334]/30 bg-[#b34334]/5 p-3 text-[13px] text-[#b34334]">
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              <Field label="Communication With Client In">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-black/12 text-[14px]"
                >
                  {["English", "French", "German", "Spanish", "Italian", "Mandarin", "Portuguese", "Swahili"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </Field>

              <div className="text-[10.5px] uppercase tracking-[0.26em] font-semibold text-black/55 pt-2">
                Client Information
              </div>

              <Field label="Email" required>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoFocus />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Last Name" required>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                </Field>
                <Field label="First Name">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Salutation">
                  <input value={salutation} onChange={(e) => setSalutation(e.target.value)} className={inputClass} placeholder="Mr. · Ms. · Mx." />
                </Field>
                <Field label="Country">
                  <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-[10.5px] uppercase tracking-[0.26em] font-semibold text-black/55">
                Trip Brief
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Nights">
                  <input type="number" min={1} max={60} value={nights} onChange={(e) => setNights(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Travelers">
                  <input type="number" min={1} max={40} value={travelers} onChange={(e) => setTravelers(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Style">
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputClass}>
                    {["Classic", "Mid-range", "Luxury", "Signature"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Destinations">
                <input
                  value={destinations}
                  onChange={(e) => setDestinations(e.target.value)}
                  placeholder="Arusha, Serengeti, Ngorongoro"
                  className={inputClass}
                />
              </Field>
              <Field label="Travel dates">
                <input
                  value={dates}
                  onChange={(e) => setDates(e.target.value)}
                  placeholder="Sept 26 – Oct 2, 2026"
                  className={inputClass}
                />
              </Field>
              <Field label="Operator note (internal)">
                <textarea
                  value={operatorNote}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-y`}
                />
              </Field>
              <Field label="Original message from client">
                <textarea
                  value={originalMessage}
                  onChange={(e) => setOriginalMessage(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                  placeholder="Paste their email or inquiry here…"
                />
              </Field>

              <div className="text-[10.5px] uppercase tracking-[0.26em] font-semibold text-black/55 pt-2">
                Lead Source & Assignment
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Source">
                  <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
                    <option value="">— select —</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Source detail (optional)">
                  <input
                    value={sourceDetail}
                    onChange={(e) => setSourceDetail(e.target.value)}
                    placeholder="Referred by Kendra"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Handled by">
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputClass}>
                  <option value="">— unassigned —</option>
                  {team.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-black/8 flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-[13px] text-black/55 hover:text-black/85">
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[13px] px-4 py-2 rounded-full border border-black/15 text-black/65 hover:border-black/30"
              >
                ← Back
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!email.trim()) { setError("Email is required"); return; }
                  setError(null);
                  setStep(2);
                }}
                className="text-[13px] px-5 py-2 rounded-full font-medium text-white"
                style={{ background: "#1b3a2d" }}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="text-[13px] px-5 py-2 rounded-full font-medium text-white disabled:opacity-50"
                style={{ background: "#1b3a2d" }}
              >
                {submitting ? "Creating…" : "Create Request"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Small UI helpers ──────────────────────────────────────────────────────

const inputClass =
  "w-full px-3 py-2 rounded border border-black/12 text-[14px] outline-none focus:border-[#1b3a2d]";

function StepTab({
  num, label, active, onClick,
}: { num: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pb-3 flex items-center gap-2 transition"
      style={{
        color: active ? "#1b3a2d" : "rgba(0,0,0,0.45)",
        borderBottom: active ? "2px solid #1b3a2d" : "2px solid transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      <span
        className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center"
        style={{
          background: active ? "#1b3a2d" : "rgba(0,0,0,0.1)",
          color: active ? "white" : "rgba(0,0,0,0.55)",
        }}
      >
        {num}
      </span>
      {label}
    </button>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11.5px] font-medium text-black/65 mb-1.5">
        {label}{required && <span className="text-[#b34334] ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}
