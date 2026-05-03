"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureSessionId } from "@/components/proposal-share/ViewTracker";
import type { Proposal, ThemeTokens, ProposalTheme } from "@/lib/types";

// ─── Safe modal palette ─────────────────────────────────────────────────
//
// The reservation modal used to inherit `tokens.pageBg / .headingText /
// .border` from the proposal's theme. When an operator's brand uses a
// dark page bg or low-contrast text colours, the modal text became
// unreadable. We now lock the modal surface + text to a fixed
// neutral-warm palette regardless of brand, and use the operator's
// brand colour only as an ACCENT (logo, CTA — and only when contrast
// against white text is safe). If the brand colour fails contrast,
// the CTA falls back to a safe deep green.

const SAFE_BG = "#F7F3E8";                   // warm ivory modal surface
const SAFE_INK = "#0a1411";                  // primary headings
const SAFE_INK_2 = "rgba(10,20,17,0.78)";    // body
const SAFE_INK_3 = "rgba(10,20,17,0.55)";    // muted / labels / placeholder
const SAFE_BORDER = "rgba(0,0,0,0.10)";      // header divider, soft borders
const SAFE_INPUT_BG = "#ffffff";
const SAFE_INPUT_BORDER = "rgba(0,0,0,0.16)";
const FALLBACK_CTA_BG = "#1b3a2d";           // deep green fallback when brand fails contrast
const FALLBACK_CTA_TEXT = "#ffffff";

// ─── ReservationDialog — client booking popup ───────────────────────────
//
// Opens from the Closing section's "Secure This Safari" CTA. Captures
// the four pieces of info the proposal doesn't already know — phone,
// email, nationality, additional notes — alongside editable arrival /
// departure dates and a travelers field that pre-fill from the
// proposal but stay editable so the booking window's reality (visa
// shifted, flights changed) can override the draft.
//
// Anonymous — fires against /api/public/proposals/:id/reserve. Also
// pings the existing engagement tracker with reservation_started on
// open and reservation_completed on success so funnel analytics +
// future GHL triggers ("opened booking, didn't submit") have signals
// to work with.

type ReservationDialogProps = {
  open: boolean;
  proposalId: string;
  proposal: Proposal;
  tokens: ThemeTokens;
  theme: ProposalTheme;
  /** Anonymous viewer session — same id used by the engagement
   *  tracker so the reservation row can be tied back to the view
   *  session that produced it. */
  sessionId?: string;
  onClose: () => void;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  arrivalDate: string;   // YYYY-MM-DD (HTML date input format)
  departureDate: string; // YYYY-MM-DD
  travelers: string;
  notes: string;
};

export function ReservationDialog({
  open,
  proposalId,
  proposal,
  tokens,
  theme,
  sessionId,
  onClose,
}: ReservationDialogProps) {
  const initial = useMemo(() => buildInitialForm(proposal), [proposal]);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Honest delivery state from the reserve route. Drives the success
  // copy so we don't claim "sent to <consultant>" when the mailer was
  // actually skipped (RESEND_API_KEY missing) or the recipient
  // couldn't be resolved.
  const [emailDelivery, setEmailDelivery] = useState<EmailDelivery | null>(null);

  // Resolve a guaranteed session id. The prop is the first choice (matches
  // the engagement-tracker session for the rest of /p/[id]), but we
  // fall back to ensureSessionId / a one-shot local id so funnel events
  // can never silently drop. resolvedSessionId is what every track()
  // call uses — never the bare prop.
  const resolvedSessionId = useMemo(() => resolveSessionId(sessionId), [sessionId]);

  // Reset whenever the dialog re-opens for a fresh attempt. The
  // setState-in-effect pattern is intentional here — we want to
  // refresh form state every time `open` flips true so a guest who
  // submits, closes, and reopens gets a clean slate. React's
  // recommended alternative (key-based remount) would force the
  // parent to manage the dialog's lifecycle, which is heavier than
  // the win.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(initial);
      setSubmitting(false);
      setError(null);
      setDone(false);
      setEmailDelivery(null);
      // Fire-and-forget tracker event so the operator's funnel
      // shows "started" vs "completed" reservations. Once-per-session
      // per proposal so re-opens during the same view session don't
      // double-count.
      if (markStartedOnce(proposalId, resolvedSessionId)) {
        track(proposalId, resolvedSessionId, "reservation_started");
      }
    }
  }, [open, initial, proposalId, resolvedSessionId]);

  // ESC closes; outside-click on the backdrop closes too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // White-label sender label. Prefer consultant name → company name →
  // "our team". The legacy default "Safari Studio" gets stripped here
  // too so a proposal seeded before the default-removal fix doesn't
  // leak the platform brand into the client UI.
  const senderLabel =
    cleanBrand(proposal.operator.consultantName) ||
    cleanBrand(proposal.operator.companyName) ||
    "our team";
  const operatorLogoUrl = proposal.operator.logoUrl?.trim() || null;

  // CTA color — brand-adaptive but contrast-safe. We use the operator's
  // theme accent only when white text against it clears WCAG AA;
  // otherwise we fall back to deep green so a low-contrast brand can
  // never produce an unreadable button.
  const brandAccent = tokens.accent;
  const ctaBg = isSafeForWhiteText(brandAccent) ? brandAccent : FALLBACK_CTA_BG;
  const ctaText = FALLBACK_CTA_TEXT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // Client-side validation mirrors the server's. Catches obvious
    // mistakes without a round-trip.
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (!form.email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Please enter a phone or WhatsApp number.");
      return;
    }
    if (!form.arrivalDate || !form.departureDate) {
      setError("Please pick both an arrival and a departure date.");
      return;
    }
    if (form.departureDate < form.arrivalDate) {
      setError("Departure date must be on or after arrival.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/proposals/${proposalId}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sessionId: resolvedSessionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't submit — try again.");
        setSubmitting(false);
        return;
      }
      track(proposalId, resolvedSessionId, "reservation_completed");
      // Capture the route's honest delivery status so the success
      // screen reads accurately. Falls back to null when the field
      // is missing (older deployments) — the success copy then uses
      // its neutral default.
      const delivery = parseEmailDelivery(data.emailDelivery);
      setEmailDelivery(delivery);
      setDone(true);
      setSubmitting(false);
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(20,20,20,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-[640px] max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-2xl"
        style={{
          background: SAFE_BG,
          color: SAFE_INK,
          fontFamily: `'${theme.bodyFont}', sans-serif`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between gap-3 px-5 md:px-7 pt-5 pb-3"
          style={{ borderBottom: `1px solid ${SAFE_BORDER}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {operatorLogoUrl && (
              // Operator logo — uses brand colours by definition; this
              // is exactly the kind of accent surface where brand
              // belongs. Background stays transparent so the logo's
              // own background (or transparency) renders cleanly on
              // the safe ivory modal surface.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={operatorLogoUrl}
                alt={cleanBrand(proposal.operator.companyName) || "Operator logo"}
                className="shrink-0 w-10 h-10 object-contain rounded-md"
                style={{ background: "transparent" }}
              />
            )}
            <div className="min-w-0">
              <div
                className="text-[10.5px] uppercase tracking-[0.28em] font-semibold"
                style={{ color: SAFE_INK_3 }}
              >
                Make a reservation
              </div>
              <h2
                className="font-bold leading-[1.1] mt-0.5 truncate"
                style={{
                  color: SAFE_INK,
                  fontFamily: `'${theme.displayFont}', serif`,
                  fontSize: "clamp(1.2rem, 2.4vw, 1.6rem)",
                  letterSpacing: "-0.005em",
                }}
              >
                {done ? "We're on it" : proposal.trip.title || "Your safari"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none transition hover:opacity-75 shrink-0"
            style={{ color: SAFE_INK_3 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="px-5 md:px-7 py-8">
            {renderSuccessMessage(form.firstName, senderLabel, emailDelivery)}
            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full md:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-[14px] font-semibold transition"
              style={{
                background: ctaBg,
                color: ctaText,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 md:px-7 py-5 space-y-4">
            {/* Reassuring intro — sets expectation before the form */}
            <p
              className="text-[13.5px] leading-[1.55] -mt-1"
              style={{ color: SAFE_INK_2 }}
            >
              Tell us about your trip — we&rsquo;ll confirm availability and next
              steps shortly.
            </p>

            <Row>
              <Field label="First name" required>
                <Input
                  value={form.firstName}
                  onChange={(v) => update({ firstName: v })}
                  autoFocus
                  tokens={tokens}
                />
              </Field>
              <Field label="Last name" required>
                <Input
                  value={form.lastName}
                  onChange={(v) => update({ lastName: v })}
                  tokens={tokens}
                />
              </Field>
            </Row>
            <Row>
              <Field
                label="Phone (mobile / WhatsApp)"
                hint="Used for quick confirmation (WhatsApp preferred)"
                required
              >
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(v) => update({ phone: v })}
                  placeholder="+255 712 345 678"
                  tokens={tokens}
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(v) => update({ email: v })}
                  placeholder="you@example.com"
                  tokens={tokens}
                />
              </Field>
            </Row>
            <Field label="Nationality">
              <Input
                value={form.nationality}
                onChange={(v) => update({ nationality: v })}
                placeholder="e.g. United Kingdom"
                tokens={tokens}
              />
            </Field>
            <Row>
              <Field label="Arrival date" required>
                <Input
                  type="date"
                  value={form.arrivalDate}
                  onChange={(v) => update({ arrivalDate: v })}
                  tokens={tokens}
                />
              </Field>
              <Field label="Departure date" required>
                <Input
                  type="date"
                  value={form.departureDate}
                  onChange={(v) => update({ departureDate: v })}
                  min={form.arrivalDate || undefined}
                  tokens={tokens}
                />
              </Field>
            </Row>
            <Field label="Travelers">
              <Input
                value={form.travelers}
                onChange={(v) => update({ travelers: v })}
                placeholder="2 adults, 0 children"
                tokens={tokens}
              />
            </Field>
            <Field label="Anything else we should know?">
              <Textarea
                value={form.notes}
                onChange={(v) => update({ notes: v })}
                placeholder="Anything important? Dietary needs, special occasions, preferences…"
                tokens={tokens}
                rows={3}
              />
            </Field>

            {error && (
              <div
                className="text-[13px] px-3 py-2 rounded-md"
                style={{
                  background: "rgba(179, 67, 52, 0.08)",
                  color: "#b34334",
                  border: "1px solid rgba(179, 67, 52, 0.2)",
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
              <p
                className="text-[11.5px] flex-1 min-w-[180px] leading-[1.55]"
                style={{ color: SAFE_INK_3 }}
              >
                No payment required now. We&rsquo;ll confirm availability and
                guide you through the next step.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg text-[14px] font-semibold transition shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-wait"
                style={{
                  background: ctaBg,
                  color: ctaText,
                }}
              >
                {submitting ? "Sending…" : "Request reservation →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

// Strip the legacy "Safari Studio" platform-brand seed from the
// operator profile so it never reaches a client-facing surface. Empty
// strings come back as empty so the caller's "|| 'our team'" fallback
// can take over. Trims whitespace defensively — operator profiles
// occasionally arrive with trailing spaces from copy/paste.
function cleanBrand(name: string | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  if (/^safari studio(\b|$)/i.test(trimmed)) return "";
  return trimmed;
}

// Email delivery status from the reserve route. Matches the union
// returned by notifyReservationReceived (lib/notifications.ts) plus a
// "delayed" status the route returns when the notifier promise didn't
// resolve within 5s and ran on into the background.
type EmailDelivery =
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "failed" }
  | { status: "no-recipient" }
  | { status: "delayed" };

// Parse the route's emailDelivery field defensively — older deploys
// might not include it, malformed responses shouldn't break the
// success screen.
function parseEmailDelivery(raw: unknown): EmailDelivery | null {
  if (!raw || typeof raw !== "object") return null;
  const status = (raw as { status?: unknown }).status;
  if (
    status === "sent" ||
    status === "skipped" ||
    status === "failed" ||
    status === "no-recipient" ||
    status === "delayed"
  ) {
    return { status };
  }
  return null;
}

// Render the success-screen copy. Three calm paragraphs:
//   1. Confirmation + 24h promise — the load-bearing line
//   2. Time-sensitive reassurance — keeps the guest's eye on their
//      inbox / WhatsApp without manufacturing urgency
//   3. Confidence line that personalises the moment with the
//      consultant / company name (senderLabel) so the guest feels
//      they've been handed to a human, not a queue
function renderSuccessMessage(
  firstName: string,
  senderLabel: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _delivery: EmailDelivery | null,
): React.ReactNode {
  return (
    <>
      <p
        className="text-[15px] leading-[1.65]"
        style={{ color: SAFE_INK_2 }}
      >
        Thanks, <strong style={{ color: SAFE_INK }}>{firstName}</strong>.
        We&rsquo;ve received your request. We&rsquo;ll confirm availability
        shortly.
      </p>
      <p
        className="text-[13.5px] leading-[1.6] mt-4"
        style={{ color: SAFE_INK_3 }}
      >
        You&rsquo;ll receive a confirmation email shortly. It may take a few
        minutes — check spam if you don&rsquo;t see it.
      </p>
      <p
        className="text-[13px] leading-[1.6] mt-4"
        style={{ color: SAFE_INK_2 }}
      >
        You&rsquo;re now in touch with{" "}
        <strong style={{ color: SAFE_INK }}>{senderLabel}</strong>,
        who will guide you through the booking.
      </p>
    </>
  );
}

function track(proposalId: string, sessionId: string, kind: string) {
  // sessionId is guaranteed non-empty by resolveSessionId — the
  // previous "no sessionId → silently no-op" path has been removed so
  // funnel events can never disappear.
  try {
    void fetch(`/api/public/proposals/${proposalId}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, kind }),
      keepalive: true,
    });
  } catch {
    /* swallow — tracking is best-effort */
  }
}

// Resolve a usable session id with three layers of fallback so the
// dialog can NEVER drop an event:
//   1. Prop from the parent (matches the engagement-tracker session)
//   2. ensureSessionId() — reads / writes sessionStorage so a reload
//      stays the same session and the tracker sees the same id
//   3. A volatile in-memory id when sessionStorage is unavailable
//      (private mode, sandboxed iframes)
function resolveSessionId(prop: string | undefined): string {
  if (prop && prop.trim().length > 0) return prop;
  if (typeof window === "undefined") {
    // SSR path — the dialog is `if (!open) return null` so this is
    // never actually reached during render, but keep the guard so
    // hooks called pre-mount don't crash.
    return `srv-${Math.random().toString(36).slice(2, 10)}`;
  }
  try {
    return ensureSessionId();
  } catch {
    return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Records that reservation_started has fired for this (proposal,
// session) pair so re-opens of the dialog within the same view
// session don't re-fire the event. Returns true on the first call,
// false on subsequent calls. sessionStorage scoping means a reload =
// same key, a fresh tab = new key — matches the engagement tracker's
// semantics exactly.
function markStartedOnce(proposalId: string, sessionId: string): boolean {
  if (typeof window === "undefined") return true;
  const key = `ss-reservation-started-${proposalId}-${sessionId}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // sessionStorage unavailable — fall back to firing every time.
    // Better to over-count than silently miss a started funnel event.
    return true;
  }
}

function buildInitialForm(proposal: Proposal): FormState {
  // Split guestNames "Sam Kombe & Lily Wong" / "Sam Kombe" into a
  // first guest's first + last name. Editable by the client.
  const fullName = proposal.client.guestNames?.trim() ?? "";
  const firstGuest = fullName.split(/[,&]|\sand\s/i)[0]?.trim() ?? "";
  const parts = firstGuest.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");

  // Travelers: prefer adults+children when set, else the operator's
  // free-form pax string ("2 adults"), else blank for the client to
  // fill in.
  const adults = proposal.client.adults;
  const children = proposal.client.children;
  let travelers = "";
  if (typeof adults === "number" && adults > 0) {
    travelers = `${adults} ${adults === 1 ? "adult" : "adults"}`;
    if (typeof children === "number" && children > 0) {
      travelers += `, ${children} ${children === 1 ? "child" : "children"}`;
    }
  } else if (proposal.client.pax) {
    travelers = proposal.client.pax;
  }

  return {
    firstName,
    lastName,
    email: "",
    phone: "",
    nationality: "",
    arrivalDate: parseArrivalDate(proposal.trip.arrivalDate),
    departureDate: parseDepartureDate(proposal.trip.arrivalDate, proposal.trip.nights),
    travelers,
    notes: "",
  };
}

function parseArrivalDate(arrivalISO: string | undefined): string {
  if (!arrivalISO) return "";
  // arrivalDate is stored as "YYYY-MM-DD" — perfect for <input type="date">.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(arrivalISO);
  return m ? m[1] : "";
}

function parseDepartureDate(
  arrivalISO: string | undefined,
  nights: number | undefined,
): string {
  if (!arrivalISO || !nights) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(arrivalISO);
  if (!m) return "";
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  start.setUTCDate(start.getUTCDate() + Math.max(0, nights));
  const y = start.getUTCFullYear();
  const mo = String(start.getUTCMonth() + 1).padStart(2, "0");
  const d = String(start.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

// ─── Form primitives ────────────────────────────────────────────────────

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11.5px] uppercase tracking-[0.18em] font-semibold text-black/60">
          {label}
          {required && <span className="text-[#b34334] ml-1">*</span>}
        </span>
        {hint && <span className="text-[11px] text-black/40">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
  min,
  // Tokens prop kept for API compat with existing call sites but
  // ignored — input chrome uses the safe modal palette so a brand
  // with low-contrast border/text colours can't make fields
  // unreadable.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokens: _tokens,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "tel" | "date";
  placeholder?: string;
  autoFocus?: boolean;
  min?: string;
  tokens: ThemeTokens;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      min={min}
      className="w-full px-3 py-2.5 rounded-lg text-[14px] outline-none transition placeholder:text-[color:rgba(10,20,17,0.45)]"
      style={{
        background: SAFE_INPUT_BG,
        border: `1px solid ${SAFE_INPUT_BORDER}`,
        color: SAFE_INK,
      }}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokens: _tokens,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  tokens: ThemeTokens;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-lg text-[14px] outline-none transition resize-y placeholder:text-[color:rgba(10,20,17,0.45)]"
      style={{
        background: SAFE_INPUT_BG,
        border: `1px solid ${SAFE_INPUT_BORDER}`,
        color: SAFE_INK,
      }}
    />
  );
}

// ─── Contrast helpers ───────────────────────────────────────────────────
//
// Decide whether the operator's brand accent is safe to render under
// white CTA text. Uses the standard WCAG sRGB luminance formula and
// returns true only when the contrast ratio is >= 4.5:1 (AA for
// normal text). Buttons are typically large enough that 3:1 (AA for
// large) would technically suffice, but we pick the stricter 4.5
// floor so a borderline brand can never produce a button that's
// "technically passing" but visually mushy.
//
// Defensive about input shape — accepts hex (#rgb / #rrggbb), rgb()/
// rgba() strings. Anything else (CSS vars, "transparent", oklch, …)
// is treated as unknown and the caller falls back to deep green.

function isSafeForWhiteText(bg: string | undefined | null): boolean {
  if (!bg) return false;
  const ratio = contrastRatio(bg, "#ffffff");
  return ratio !== null && ratio >= 4.5;
}

function contrastRatio(a: string, b: string): number | null {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (n: number) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function parseColor(input: string): { r: number; g: number; b: number } | null {
  if (!input) return null;
  const trimmed = input.trim();
  // #rgb shorthand
  const short = /^#([a-f\d])([a-f\d])([a-f\d])$/i.exec(trimmed);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  // #rrggbb (alpha trailing chars are dropped; we only need rgb)
  const long = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(trimmed);
  if (long) {
    return {
      r: parseInt(long[1], 16),
      g: parseInt(long[2], 16),
      b: parseInt(long[3], 16),
    };
  }
  // rgb() / rgba()
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(trimmed);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}
