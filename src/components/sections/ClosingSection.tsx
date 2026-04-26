"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import {
  DEFAULT_TRUST_BADGES,
  type Section,
  type Proposal,
  type OperatorProfile,
  type ClientDetails,
  type TripDetails,
  type PricingData,
  type TierKey,
  type ThemeTokens,
  type ProposalTheme,
} from "@/lib/types";

// Closing — five layout variants (closing-farewell default, plus
// quote-led, letter-style, centered-minimal, cta-card). Every variant
// now ends in the same Book-only footer (Confirm Booking, Download
// Quote, Share) — the consultant's contact details have moved out to
// the standalone FooterSection, which renders right after closing.

export function ClosingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme, client, trip, activeTier, pricing } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant;
  const quote = section.content.quote as string;
  const signOff = section.content.signOff as string;
  const attribution = section.content.attribution as string | undefined;

  const onSignOff = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff });
  const onQuote = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { quote: e.currentTarget.textContent ?? quote });
  const onAttribution = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, {
      attribution: e.currentTarget.textContent ?? attribution ?? "",
    });

  // Which AI write buttons make sense depends on what the variant renders.
  // Quote-only variants (cta-card) get one button; sign-off-only variants
  // (letter-style, centered-minimal) get the other; variants that show
  // both (closing-farewell, quote-led) get both stacked.
  const variantHasQuote =
    variant === "closing-farewell" ||
    variant === "booking-recap" ||
    variant === "quote-led" ||
    variant === "cta-card";
  const variantHasSignOff =
    variant === "closing-farewell" ||
    variant === "booking-recap" ||
    variant === "quote-led" ||
    variant === "letter-style" ||
    variant === "centered-minimal";

  const aiButtons = isEditor ? (
    <div className="absolute top-14 right-4 z-[35] flex items-center gap-2" data-editor-chrome>
      {variantHasQuote && (
        <AIWriteButton
          kind="closing-quote"
          currentText={quote ?? ""}
          context={{ clientName: client.guestNames, destinations: trip.destinations }}
          onResult={(text) => updateSectionContent(section.id, { quote: text })}
          compact
        />
      )}
      {variantHasSignOff && (
        <AIWriteButton
          kind="closing-signoff"
          currentText={signOff ?? ""}
          context={{
            clientName: client.guestNames,
            consultantName: operator.consultantName,
          }}
          onResult={(text) => updateSectionContent(section.id, { signOff: text })}
          compact
        />
      )}
    </div>
  ) : null;

  // ── Booking-recap ─────────────────────────────────────────────────────────
  // Editorial intro on the left, booking card on the right. Reassurance
  // bullets, destination chips, and 4 day-image tiles tie the trip together
  // before the moment of conversion. Framer Motion drives the staggered
  // scroll-reveal and the CTA hover.
  if (variant === "booking-recap") {
    return (
      <BookingRecapVariant
        section={section}
        proposal={proposal}
        tokens={tokens}
        isEditor={isEditor}
        onQuote={onQuote}
        onSignOff={onSignOff}
        aiButtons={aiButtons}
      />
    );
  }

  // ── Closing-farewell (default) ────────────────────────────────────────────
  // Combined closing + footer. Pull-quote + sign-off on top, two-column
  // branded footer below (Book your Safari / Contact Us). Defaults to a
  // dark background; operators can change it via the section chrome's
  // background picker.
  if (variant === "closing-farewell") {
    // Use the section's background override if one is set; otherwise the
    // editorial-dark palette.
    const overrides = section.styleOverrides as Record<string, string> | undefined;
    const bg = overrides?.sectionSurface ?? "#1d1d1f";
    // Heuristic: if the operator kept the dark default, swap the text
    // tokens for light-on-dark; otherwise use the theme tokens as-is.
    const isDark = isDarkColor(bg);
    const color = {
      heading: isDark ? "rgba(255,255,255,0.92)" : tokens.headingText,
      body: isDark ? "rgba(255,255,255,0.78)" : tokens.bodyText,
      muted: isDark ? "rgba(255,255,255,0.45)" : tokens.mutedText,
      border: isDark ? "rgba(255,255,255,0.14)" : tokens.border,
      accent: tokens.accent,
      button: isDark ? "rgba(255,255,255,0.1)" : "#00000008",
      buttonBorder: isDark ? "rgba(255,255,255,0.25)" : tokens.border,
      coverLift: isDark ? "rgba(255,255,255,0.04)" : tokens.cardBg,
    };

    const coverSection = proposal.sections.find((s) => s.type === "cover");
    const coverThumbUrl = (coverSection?.content?.heroImageUrl as string | undefined) ?? null;

    const pax = parsePax(client.pax);
    const tierKey = activeTier as keyof typeof pricing;
    // Pricing indexer also has a "notes" string field; narrow to the tier objects.
    const tier =
      tierKey === "classic" || tierKey === "premier" || tierKey === "signature"
        ? pricing[tierKey]
        : null;
    const perPerson = tier?.pricePerPerson ?? "";
    const currency = tier?.currency ?? "USD";
    const totalLabel = buildTotalLabel(perPerson, currency, pax);

    const confirmBookingHref = resolveBookingHref(operator, proposal, totalLabel);
    const whatsappShareHref = typeof window !== "undefined"
      ? `https://wa.me/?text=${encodeURIComponent(`${trip.title || "Safari proposal"} — ${window.location.href}`)}`
      : "#";

    const copyLink = async () => {
      if (typeof window === "undefined") return;
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch {
        // no-op — clipboard might be blocked
      }
    };

    const requestConfirmInComments = () => {
      if (typeof window === "undefined") return;
      const message = `I'd like to confirm the booking for ${trip.title || "this safari"}. Please send next steps.`;
      window.dispatchEvent(new CustomEvent("ss:prefillComment", { detail: { message } }));
    };

    return (
      <div className="relative py-28 md:py-32 px-8 md:px-16" style={{ background: bg }}>
        {aiButtons}

        <div className="max-w-4xl mx-auto">
          {/* ── Pull-quote + sign-off note ──────────────────────────── */}
          <div className="text-center">
            <div
              aria-hidden
              className="select-none mx-auto"
              style={{
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "3rem",
                lineHeight: 0.7,
                color: color.accent,
                opacity: isDark ? 0.7 : 0.5,
              }}
            >
              &ldquo;
            </div>
            <blockquote
              className="mt-2 mx-auto max-w-[640px] font-semibold leading-[1.2] outline-none"
              style={{
                color: color.heading,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(1.65rem, 2.8vw, 2.25rem)",
                letterSpacing: "-0.005em",
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="closing"
              onBlur={onQuote}
            >
              {quote}
            </blockquote>
            {(attribution || isEditor) && (
              <div
                className="mt-3 text-[12px] uppercase tracking-[0.22em] outline-none"
                style={{ color: color.muted }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={onAttribution}
              >
                {attribution || (isEditor ? "– Attribution" : "")}
              </div>
            )}
            {(signOff || isEditor) && (
              <p
                className="mt-10 mx-auto text-[14.5px] leading-[1.8] whitespace-pre-line outline-none max-w-xl"
                style={{ color: color.body }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                data-ai-editable="closing"
                onBlur={onSignOff}
              >
                {signOff}
              </p>
            )}
          </div>

          {/* Hairline divider */}
          <div
            aria-hidden
            className="mx-auto mt-20 mb-16"
            style={{ height: 1, width: 80, background: color.border }}
          />

          {/* ── Booking-only footer — contact details now live in the
              standalone Footer section that renders right after this one. */}
          <div className="max-w-xl mx-auto">
            <div>
              <div
                className="text-[10.5px] uppercase tracking-[0.3em] font-bold mb-4"
                style={{ color: color.muted }}
              >
                Book your Safari
              </div>

              {/* Cover thumb + title */}
              <div className="flex items-stretch gap-4 mb-6">
                {coverThumbUrl ? (
                  <div
                    className="shrink-0 overflow-hidden"
                    style={{ width: 64, height: 84, background: color.coverLift, borderRadius: 2 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverThumbUrl}
                      alt="Proposal cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="shrink-0 flex items-center justify-center text-[10px] uppercase tracking-[0.2em]"
                    style={{
                      width: 64,
                      height: 84,
                      background: color.coverLift,
                      color: color.muted,
                      borderRadius: 2,
                    }}
                  >
                    Cover
                  </div>
                )}
                <div className="min-w-0 flex flex-col justify-center">
                  <div
                    className="text-[14.5px] font-semibold leading-[1.35]"
                    style={{
                      color: color.heading,
                      fontFamily: `'${theme.displayFont}', serif`,
                    }}
                  >
                    {trip.title}
                  </div>
                  {client.guestNames && (
                    <div
                      className="mt-1 text-[12px]"
                      style={{ color: color.muted }}
                    >
                      for {client.guestNames}
                    </div>
                  )}
                </div>
              </div>

              {/* Total price */}
              {totalLabel && (
                <div className="mb-6 text-[13.5px]" style={{ color: color.body }}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold" style={{ color: color.heading }}>
                      Total:
                    </span>
                    <span style={{ color: color.heading }}>{totalLabel}</span>
                  </div>
                  <a
                    href="#pricing"
                    className="mt-1 inline-block text-[12px] transition hover:opacity-75"
                    style={{
                      color: color.muted,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    Detailed price information →
                  </a>
                </div>
              )}

              {/* Primary CTAs — Confirm Booking is the moment of conversion;
                  size it for prominence over the Download Quote alternate. */}
              <a
                href={confirmBookingHref}
                className="h-14 mb-3 w-full flex items-center justify-center text-[15px] font-bold uppercase tracking-[0.12em] rounded-sm transition hover:opacity-90 active:scale-[0.99]"
                style={{
                  background: isDark ? "white" : color.accent,
                  color: isDark ? "#1d1d1f" : "white",
                  maxWidth: 420,
                  boxShadow: isDark
                    ? "0 4px 18px rgba(255,255,255,0.18)"
                    : "0 4px 18px rgba(0,0,0,0.18)",
                }}
              >
                Confirm Booking →
              </a>
              <div className="mb-3" style={{ maxWidth: 420 }}>
                <DownloadPdfButton
                  proposalId={proposal.id}
                  background={color.button}
                  textColor={color.heading}
                  borderColor={color.buttonBorder}
                />
              </div>
              <button
                type="button"
                onClick={requestConfirmInComments}
                className="text-[12px] transition hover:opacity-75 mb-10"
                style={{
                  color: color.muted,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Or reply with a note in comments →
              </button>

              {/* Share */}
              <div
                className="text-[10.5px] uppercase tracking-[0.3em] font-bold mb-3"
                style={{ color: color.muted }}
              >
                Share with family and friends
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={whatsappShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on WhatsApp"
                  className="w-10 h-10 rounded-full flex items-center justify-center transition hover:opacity-80"
                  style={{ border: `1px solid ${color.buttonBorder}`, color: color.heading }}
                >
                  <WaIcon />
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copy link"
                  className="w-10 h-10 rounded-full flex items-center justify-center transition hover:opacity-80"
                  style={{ border: `1px solid ${color.buttonBorder}`, color: color.heading }}
                >
                  <LinkIcon />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Centered-minimal ──────────────────────────────────────────────────────
  if (variant === "centered-minimal") {
    return (
      <div className="py-24 relative px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
        {aiButtons}
        <div className="ed-narrow text-center" style={{ maxWidth: 480 }}>
          <div className="w-12 mx-auto mb-8" style={{ height: "2px", background: tokens.accent }} />
          <p
            className="text-body-lg leading-loose mb-8 outline-none"
            style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            data-ai-editable="closing"
            onBlur={onSignOff}
          >
            {signOff}
          </p>
          <div className="text-small font-semibold" style={{ color: tokens.headingText }}>
            {operator.consultantName}
          </div>
          <div className="text-label" style={{ color: tokens.mutedText, textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
            {operator.companyName}
          </div>
        </div>
        <BookOnlyFooter
          proposal={proposal}
          operator={operator}
          client={client}
          trip={trip}
          pricing={pricing}
          activeTier={activeTier as TierKey}
          theme={theme}
          tokens={tokens}
          bg={tokens.sectionSurface}
        />
      </div>
    );
  }

  // ── CTA-card ──────────────────────────────────────────────────────────────
  if (variant === "cta-card") {
    return (
      <div className="py-24 relative px-8 md:px-16" style={{ background: tokens.pageBg }}>
        {aiButtons}
        <div className="ed-narrow">
          <div
            className="p-12 md:p-16 rounded-2xl text-center"
            style={{ background: tokens.accent }}
          >
            <blockquote
              className="text-h2 font-medium mb-8 outline-none"
              style={{ color: "rgba(255,255,255,0.92)", fontFamily: `'${theme.displayFont}', serif` }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="closing"
              onBlur={onQuote}
            >
              {quote}
            </blockquote>
            <div className="w-10 mx-auto mb-8" style={{ height: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div className="text-small font-semibold text-white/85">{operator.consultantName}</div>
            <div className="text-label text-white/50" style={{ textTransform: "none", letterSpacing: "0", fontWeight: 400 }}>
              {operator.companyName}
            </div>
          </div>
        </div>
        <BookOnlyFooter
          proposal={proposal}
          operator={operator}
          client={client}
          trip={trip}
          pricing={pricing}
          activeTier={activeTier as TierKey}
          theme={theme}
          tokens={tokens}
          bg={tokens.pageBg}
        />
      </div>
    );
  }

  // ── Letter-style ──────────────────────────────────────────────────────────
  if (variant === "letter-style") {
    return (
      <div className="py-24 relative px-8 md:px-16" style={{ background: tokens.sectionSurface }}>
        {aiButtons}
        <div className="ed-narrow space-y-8" style={{ maxWidth: 580 }}>
          <p
            className="text-body leading-loose whitespace-pre-line outline-none"
            style={{ color: tokens.bodyText, fontFamily: `'${theme.bodyFont}', sans-serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            data-ai-editable="closing"
            onBlur={onSignOff}
          >
            {signOff}
          </p>
          <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
            <div
              className="text-h3 font-semibold"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              {operator.consultantName}
            </div>
            <div className="text-small" style={{ color: tokens.mutedText }}>{operator.companyName}</div>
          </div>
        </div>
        <BookOnlyFooter
          proposal={proposal}
          operator={operator}
          client={client}
          trip={trip}
          pricing={pricing}
          activeTier={activeTier as TierKey}
          theme={theme}
          tokens={tokens}
          bg={tokens.sectionSurface}
        />
      </div>
    );
  }

  // ── Quote-led (legacy default) ───────────────────────────────────────────
  return (
    <div className="py-24 relative px-8 md:px-16" style={{ background: tokens.accent }}>
      {aiButtons}
      <div className="ed-narrow text-center">
        <div
          aria-hidden
          className="select-none leading-none"
          style={{
            fontFamily: `'${theme.displayFont}', serif`,
            fontSize: "6.5rem",
            color: tokens.secondaryAccent,
            opacity: 0.55,
            lineHeight: 0.9,
          }}
        >
          &ldquo;
        </div>

        <blockquote
          className="text-h1 font-medium -mt-3 outline-none"
          style={{ color: "rgba(255,255,255,0.92)", fontFamily: `'${theme.displayFont}', serif` }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          data-ai-editable="closing"
          onBlur={onQuote}
        >
          {quote}
        </blockquote>

        <div className="mt-12 pt-10 border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <p
            className="text-small italic mb-6 outline-none"
            style={{ color: "rgba(255,255,255,0.6)", fontFamily: `'${theme.displayFont}', serif` }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            data-ai-editable="closing"
            onBlur={onSignOff}
          >
            {signOff}
          </p>
          <div
            className="text-h3 font-semibold"
            style={{ color: "rgba(255,255,255,0.88)", fontFamily: `'${theme.displayFont}', serif` }}
          >
            {operator.consultantName}
          </div>
          <div className="text-small mt-1 text-white/45">{operator.companyName}</div>
        </div>
      </div>
      <BookOnlyFooter
        proposal={proposal}
        operator={operator}
        client={client}
        trip={trip}
        pricing={pricing}
        activeTier={activeTier as TierKey}
        theme={theme}
        tokens={tokens}
        bg={tokens.accent}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isDarkColor(hex: string): boolean {
  // Accept hex or rgba() / rgb(). Treat unknown formats as light so the
  // default behaviour is safe.
  const h = hex.trim();
  if (h.startsWith("#")) {
    const clean = h.slice(1);
    const v =
      clean.length === 3
        ? clean.split("").map((c) => parseInt(c + c, 16))
        : clean.length === 6
          ? [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16))
          : null;
    if (!v) return false;
    const [r, g, b] = v;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum < 0.5;
  }
  const rgbMatch = /rgba?\(([^)]+)\)/.exec(h);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((s) => Number(s.trim()));
    const [r, g, b] = parts;
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return lum < 0.5;
    }
  }
  return false;
}

function parsePax(raw: string | undefined): number {
  if (!raw) return 0;
  // Pull the first integer we find — e.g. "2 adults · 3 children" → 2,
  // then add subsequent integers. Rough but good enough for the closing
  // card: "8 Adults" → 8, "2 adults + 3 children (ages 8, 11, 14)" → 5.
  const nums = raw.match(/\d+/g);
  if (!nums) return 0;
  // Heuristic: sum adults + children but ignore numbers that are likely
  // ages (> 15 we treat as headcount; ≤ 15 after first number is an age).
  let total = 0;
  let seenHeadcount = false;
  for (const n of nums) {
    const num = parseInt(n, 10);
    if (!Number.isFinite(num)) continue;
    if (!seenHeadcount) {
      total = num;
      seenHeadcount = true;
      continue;
    }
    // Only add if the number is small-ish (children headcount) AND there
    // are obvious group words. Keep it simple: add up to the second one
    // then stop — addresses "2 adults · 3 children" without counting
    // age listings.
    if (total < 20 && num <= 12) {
      total += num;
      break;
    }
    break;
  }
  return total;
}

function buildTotalLabel(perPerson: string, currency: string, pax: number): string {
  const pp = perPerson.replace(/[^\d.,]/g, "");
  const asNumber = Number(pp.replace(/,/g, ""));
  if (!Number.isFinite(asNumber) || asNumber <= 0) return "";
  if (pax > 1) {
    const total = asNumber * pax;
    return `${currency} ${formatNumber(total)}`;
  }
  return `${currency} ${formatNumber(asNumber)} per person`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Resolve the target for the "Book / Confirm Booking" CTAs. Priority:
//   1. operator.bookingUrl — dedicated reservation surface on the operator's
//      own site (a calendar embed, Stripe checkout, branded form, etc.).
//   2. operator.website — their homepage. Less specific but still on their
//      turf, not ours.
//   3. mailto: operator.email — last-resort fallback. The classic "send
//      us an email" flow, kept so the button never dead-ends.
//
// Clients returning via the booking URL / website open in a new tab so
// they don't lose the proposal context.
function resolveBookingHref(
  operator: {
    bookingUrl?: string;
    website?: string;
    email?: string;
  },
  proposal: { id: string; trip: { title: string }; client: { guestNames: string } },
  totalLabel: string,
): string {
  const booking = operator.bookingUrl?.trim();
  if (booking) return normaliseUrl(booking);
  const website = operator.website?.trim();
  if (website) return normaliseUrl(website);
  return buildMailtoHref(operator.email, proposal, totalLabel);
}

function buildMailtoHref(
  email: string | undefined,
  proposal: { id: string; trip: { title: string }; client: { guestNames: string } },
  totalLabel: string,
): string {
  if (!email) return "#";
  const subject = `Confirm booking — ${proposal.trip.title || "Safari"}`;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const body = [
    `Hi,`,
    `I'd like to confirm the booking for ${proposal.trip.title || "this safari"}${
      proposal.client.guestNames ? ` (${proposal.client.guestNames})` : ""
    }.`,
    totalLabel ? `Total as quoted: ${totalLabel}.` : "",
    url ? `Proposal: ${url}` : "",
    `Please send the next steps.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function normaliseUrl(url: string | undefined): string {
  if (!url) return "#";
  const t = url.trim();
  if (!t) return "#";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function WaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4L3 21" />
      <path d="M9 10a3 3 0 0 0 3 3l1.5-1.5a1 1 0 0 1 1 0l2 1.3a1 1 0 0 1 .3 1.2l-.3.6a3 3 0 0 1-3 2" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5" />
      <path d="M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5" />
    </svg>
  );
}

// ─── Shared Book-only footer ──────────────────────────────────────────────
//
// Every closing variant renders this block at the bottom — Book your
// Safari + Confirm / Download / Share. Contact details now live solely
// in the standalone FooterSection that renders right after closing, so
// the closing block stays focused on the moment of conversion.

function BookOnlyFooter({
  proposal,
  operator,
  client,
  trip,
  pricing,
  activeTier,
  theme,
  tokens,
  bg,
}: {
  proposal: Proposal;
  operator: OperatorProfile;
  client: ClientDetails;
  trip: TripDetails;
  pricing: PricingData;
  activeTier: TierKey;
  theme: ProposalTheme;
  tokens: ThemeTokens;
  bg: string;
}) {
  const isDark = isDarkColor(bg);
  const color = {
    heading: isDark ? "rgba(255,255,255,0.92)" : tokens.headingText,
    body: isDark ? "rgba(255,255,255,0.78)" : tokens.bodyText,
    muted: isDark ? "rgba(255,255,255,0.45)" : tokens.mutedText,
    border: isDark ? "rgba(255,255,255,0.14)" : tokens.border,
    accent: tokens.accent,
    button: isDark ? "rgba(255,255,255,0.1)" : "#00000008",
    buttonBorder: isDark ? "rgba(255,255,255,0.25)" : tokens.border,
    coverLift: isDark ? "rgba(255,255,255,0.04)" : tokens.cardBg,
  };

  const coverSection = proposal.sections.find((s) => s.type === "cover");
  const coverThumbUrl = (coverSection?.content?.heroImageUrl as string | undefined) ?? null;

  const pax = parsePax(client.pax);
  const tier =
    activeTier === "classic" || activeTier === "premier" || activeTier === "signature"
      ? pricing[activeTier]
      : null;
  const perPerson = tier?.pricePerPerson ?? "";
  const currency = tier?.currency ?? "USD";
  const totalLabel = buildTotalLabel(perPerson, currency, pax);

  const confirmBookingHref = buildMailtoHref(operator.email, proposal, totalLabel);
  const whatsappShareHref =
    typeof window !== "undefined"
      ? `https://wa.me/?text=${encodeURIComponent(
          `${trip.title || "Safari proposal"} — ${window.location.href}`,
        )}`
      : "#";

  const copyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // no-op
    }
  };

  const requestConfirmInComments = () => {
    if (typeof window === "undefined") return;
    const message = `I'd like to confirm the booking for ${trip.title || "this safari"}. Please send next steps.`;
    window.dispatchEvent(new CustomEvent("ss:prefillComment", { detail: { message } }));
  };

  return (
    <div
      className="max-w-xl mx-auto mt-16 md:mt-20 pt-12"
      style={{
        borderTop: `1px solid ${color.border}`,
      }}
    >
      {/* Book your Safari — contact details live in the FooterSection now */}
      <div>
        <div
          className="text-[10.5px] uppercase tracking-[0.3em] font-bold mb-4 text-left"
          style={{ color: color.muted }}
        >
          Book your Safari
        </div>

        <div className="flex items-stretch gap-4 mb-6 text-left">
          {coverThumbUrl ? (
            <div
              className="shrink-0 overflow-hidden"
              style={{ width: 64, height: 84, background: color.coverLift, borderRadius: 2 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverThumbUrl} alt="Proposal cover" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="shrink-0 flex items-center justify-center text-[10px] uppercase tracking-[0.2em]"
              style={{
                width: 64,
                height: 84,
                background: color.coverLift,
                color: color.muted,
                borderRadius: 2,
              }}
            >
              Cover
            </div>
          )}
          <div className="min-w-0 flex flex-col justify-center">
            <div
              className="text-[14.5px] font-semibold leading-[1.35]"
              style={{
                color: color.heading,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
            >
              {trip.title}
            </div>
            {client.guestNames && (
              <div className="mt-1 text-[12px]" style={{ color: color.muted }}>
                for {client.guestNames}
              </div>
            )}
          </div>
        </div>

        {totalLabel && (
          <div className="mb-6 text-[13.5px] text-left" style={{ color: color.body }}>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold" style={{ color: color.heading }}>Total:</span>
              <span style={{ color: color.heading }}>{totalLabel}</span>
            </div>
            <a
              href="#pricing"
              className="mt-1 inline-block text-[12px] transition hover:opacity-75"
              style={{ color: color.muted, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Detailed price information →
            </a>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3" style={{ maxWidth: 360 }}>
          <DownloadPdfButton
            proposalId={proposal.id}
            background={color.button}
            textColor={color.heading}
            borderColor={color.buttonBorder}
          />
          <a
            href={confirmBookingHref}
            className="h-10 flex items-center justify-center text-[12.5px] font-semibold rounded-sm transition hover:opacity-90"
            style={{
              background: isDark ? "white" : color.accent,
              color: isDark ? "#1d1d1f" : "white",
            }}
          >
            Confirm Booking
          </a>
        </div>
        <button
          type="button"
          onClick={requestConfirmInComments}
          className="text-[12px] transition hover:opacity-75 mb-10 text-left"
          style={{ color: color.muted, textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Or reply with a note in comments →
        </button>

        <div
          className="text-[10.5px] uppercase tracking-[0.3em] font-bold mb-3 text-left"
          style={{ color: color.muted }}
        >
          Share with family and friends
        </div>
        <div className="flex items-center gap-2">
          <a
            href={whatsappShareHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share on WhatsApp"
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:opacity-80"
            style={{ border: `1px solid ${color.buttonBorder}`, color: color.heading }}
          >
            <WaIcon />
          </a>
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copy link"
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:opacity-80"
            style={{ border: `1px solid ${color.buttonBorder}`, color: color.heading }}
          >
            <LinkIcon />
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Download Quote button ────────────────────────────────────────────────
// POSTs to the public PDF endpoint (no org auth — guests viewing the share
// link don't have one) and triggers a real file download. Replaces the old
// "open the print webview in a new tab" behaviour, which left guests
// staring at the on-screen rendition and wondering where the download was.

function DownloadPdfButton({
  proposalId,
  background,
  textColor,
  borderColor,
}: {
  proposalId: string;
  background: string;
  textColor: string;
  borderColor: string;
}) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/proposals/${proposalId}/pdf`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^"]+)"?/.exec(cd);
      const a = document.createElement("a");
      a.href = url;
      a.download = match ? match[1] : `proposal-${proposalId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="h-10 flex items-center justify-center text-[12.5px] font-semibold rounded-sm transition hover:opacity-85 disabled:opacity-65 disabled:cursor-wait"
      style={{ background, color: textColor, border: `1px solid ${borderColor}` }}
    >
      {busy ? "Preparing PDF…" : "Download Quote"}
    </button>
  );
}

// ─── Booking-recap variant ────────────────────────────────────────────────
//
// Shadcn-caliber two-column closing — letter-mood intro on the left, hard
// booking card on the right. Framer Motion drives staggered scroll-reveal
// and the CTA's micro-interactions. Day hero images become experience
// tiles. Trust bullets pull from operator.trustBadges (or the default
// list when nothing's configured).

function BookingRecapVariant({
  section,
  proposal,
  tokens,
  isEditor,
  onQuote,
  onSignOff,
  aiButtons,
}: {
  section: Section;
  proposal: Proposal;
  tokens: ThemeTokens;
  isEditor: boolean;
  onQuote: (e: React.FocusEvent<HTMLElement>) => void;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
  aiButtons: React.ReactNode;
}) {
  const { operator, theme, client, trip, activeTier, pricing, days } = proposal;
  const overrides = section.styleOverrides as Record<string, string> | undefined;
  const bg = overrides?.sectionSurface ?? "#0d1714";
  const isDark = isDarkColor(bg);
  const color = {
    heading: isDark ? "rgba(255,255,255,0.96)" : tokens.headingText,
    body: isDark ? "rgba(255,255,255,0.74)" : tokens.bodyText,
    muted: isDark ? "rgba(255,255,255,0.45)" : tokens.mutedText,
    border: isDark ? "rgba(255,255,255,0.10)" : tokens.border,
    softBorder: isDark ? "rgba(255,255,255,0.06)" : `${tokens.border}80`,
    surface: isDark ? "rgba(255,255,255,0.04)" : tokens.cardBg,
    accent: tokens.accent,
    chipBg: isDark ? "rgba(255,255,255,0.06)" : `${tokens.accent}10`,
    chipText: isDark ? "rgba(255,255,255,0.82)" : tokens.headingText,
    cta: isDark ? "#ffffff" : tokens.accent,
    ctaText: isDark ? "#0d1714" : "#ffffff",
  };

  const quote = (section.content.quote as string) ?? "";
  const signOff = (section.content.signOff as string) ?? "";

  const tierKey = activeTier as keyof typeof pricing;
  const tier =
    tierKey === "classic" || tierKey === "premier" || tierKey === "signature"
      ? pricing[tierKey]
      : null;
  const pax = parsePax(client.pax);
  const perPerson = tier?.pricePerPerson ?? "";
  const currency = tier?.currency ?? "USD";
  const totalLabel = buildTotalLabel(perPerson, currency, pax);
  const confirmBookingHref = resolveBookingHref(operator, proposal, totalLabel);

  // Pick up to 4 day hero images for the experience tiles. Falls back to
  // a count of however many we actually have.
  const dayTiles = days
    .filter((d) => !!d.heroImageUrl)
    .slice(0, 4)
    .map((d) => ({
      id: d.id,
      label: d.destination || d.subtitle || `Day ${d.dayNumber}`,
      url: d.heroImageUrl as string,
      objectPosition: d.heroImagePosition || "50% 50%",
    }));

  const trustBadges =
    operator.trustBadges && operator.trustBadges.length > 0
      ? operator.trustBadges
      : DEFAULT_TRUST_BADGES;

  const stagger = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  } as const;
  const item = {
    hidden: { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  } as const;

  return (
    <div className="relative py-24 md:py-28 px-6 md:px-12 lg:px-16" style={{ background: bg }}>
      {aiButtons}

      <motion.div
        className="max-w-6xl mx-auto"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14">
          {/* ── Left column ── */}
          <div className="lg:pr-4">
            <motion.div variants={item}>
              <div
                className="text-[10.5px] uppercase tracking-[0.32em] font-semibold mb-5"
                style={{ color: color.muted }}
              >
                One last thing
              </div>
            </motion.div>

            <motion.blockquote
              variants={item}
              className="font-semibold leading-[1.18] outline-none"
              style={{
                color: color.heading,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(1.7rem, 3vw, 2.45rem)",
                letterSpacing: "-0.012em",
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="closing"
              onBlur={onQuote}
            >
              {quote}
            </motion.blockquote>

            {(signOff || isEditor) && (
              <motion.p
                variants={item}
                className="mt-6 max-w-[520px] text-[14.5px] leading-[1.75] whitespace-pre-line outline-none"
                style={{
                  color: color.body,
                  fontFamily: `'${theme.bodyFont}', sans-serif`,
                }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                data-ai-editable="closing"
                onBlur={onSignOff}
              >
                {signOff}
              </motion.p>
            )}

            {/* Hairline + trip recap */}
            <motion.div
              variants={item}
              aria-hidden
              className="mt-10 mb-7"
              style={{ height: 1, width: 64, background: color.border }}
            />

            <motion.div variants={item}>
              <div
                className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3"
                style={{ color: color.muted }}
              >
                Itinerary at a glance
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(trip.destinations ?? []).map((d) => (
                  <span
                    key={d}
                    className="text-[11.5px] font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: color.chipBg,
                      color: color.chipText,
                      border: `1px solid ${color.softBorder}`,
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Experience tiles — day hero images */}
            {dayTiles.length > 0 && (
              <motion.div variants={item} className="mt-8">
                <div
                  className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3"
                  style={{ color: color.muted }}
                >
                  Experiences included
                </div>
                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
                  variants={stagger}
                >
                  {dayTiles.map((tile) => (
                    <motion.div
                      key={tile.id}
                      variants={item}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="group relative overflow-hidden rounded-xl aspect-[4/5]"
                      style={{
                        background: color.surface,
                        border: `1px solid ${color.softBorder}`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tile.url}
                        alt={tile.label}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                        style={{ objectPosition: tile.objectPosition }}
                      />
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.66) 100%)",
                        }}
                      />
                      <div className="absolute left-2.5 right-2.5 bottom-2 text-[11px] font-semibold text-white/95 leading-tight">
                        {tile.label}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </div>

          {/* ── Right column — booking card ── */}
          <motion.div
            variants={item}
            className="relative rounded-2xl p-6 md:p-7 backdrop-blur-md"
            style={{
              background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
              border: `1px solid ${color.softBorder}`,
              boxShadow: isDark
                ? "0 30px 60px -25px rgba(0,0,0,0.5)"
                : "0 24px 60px -28px rgba(0,0,0,0.18)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-3"
              style={{ color: color.muted }}
            >
              Your safari
            </div>
            <h3
              className="font-semibold leading-[1.1]"
              style={{
                color: color.heading,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(1.35rem, 2.4vw, 1.7rem)",
                letterSpacing: "-0.005em",
              }}
            >
              {trip.title}
            </h3>
            {trip.dates && (
              <div
                className="mt-1.5 text-[12.5px]"
                style={{ color: color.muted }}
              >
                {trip.dates}
                {trip.nights ? ` · ${trip.nights} night${trip.nights === 1 ? "" : "s"}` : ""}
              </div>
            )}
            {client.guestNames && (
              <div
                className="mt-0.5 text-[12px]"
                style={{ color: color.muted }}
              >
                For {client.guestNames}
              </div>
            )}

            {/* Price */}
            {totalLabel && (
              <div
                className="mt-5 pt-5"
                style={{ borderTop: `1px solid ${color.softBorder}` }}
              >
                <div
                  className="text-[10.5px] uppercase tracking-[0.28em] font-semibold mb-1"
                  style={{ color: color.muted }}
                >
                  Total
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-semibold tabular-nums leading-none"
                    style={{
                      color: color.heading,
                      fontFamily: `'${theme.displayFont}', serif`,
                      fontSize: "clamp(2rem, 3.6vw, 2.6rem)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {totalLabel.replace(/\sper\sperson$/i, "")}
                  </span>
                </div>
                <a
                  href="#pricing"
                  className="mt-1 inline-block text-[11.5px] transition hover:opacity-75"
                  style={{
                    color: color.muted,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Detailed price information →
                </a>
              </div>
            )}

            {/* CTAs */}
            <div className="mt-5 space-y-2">
              <motion.a
                href={confirmBookingHref}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="h-12 w-full flex items-center justify-center text-[13.5px] font-bold uppercase tracking-[0.12em] rounded-xl transition shadow-md hover:shadow-lg"
                style={{
                  background: color.cta,
                  color: color.ctaText,
                }}
              >
                Continue Booking →
              </motion.a>
              <DownloadPdfButton
                proposalId={proposal.id}
                background={isDark ? "rgba(255,255,255,0.04)" : "#fafafa"}
                textColor={color.heading}
                borderColor={color.softBorder}
              />
            </div>

            {/* Trust badges */}
            <div
              className="mt-6 pt-5"
              style={{ borderTop: `1px solid ${color.softBorder}` }}
            >
              <ul className="space-y-2.5">
                {trustBadges.map((badge, i) => (
                  <motion.li
                    key={`${i}-${badge.slice(0, 12)}`}
                    initial={{ opacity: 0, x: 4 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.45,
                      delay: 0.1 + i * 0.05,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex items-start gap-2.5 text-[12.5px] leading-snug"
                    style={{ color: color.body }}
                  >
                    <CheckGlyph color={color.accent} />
                    <span>{badge}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Consultant signature */}
            <div
              className="mt-6 pt-5 flex items-center gap-3"
              style={{ borderTop: `1px solid ${color.softBorder}` }}
            >
              {operator.consultantPhoto ? (
                <div
                  className="shrink-0 w-9 h-9 rounded-full overflow-hidden"
                  style={{ background: color.surface }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={operator.consultantPhoto}
                    alt={operator.consultantName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                  style={{
                    background: `${color.accent}1c`,
                    color: color.accent,
                  }}
                >
                  {operator.consultantName?.charAt(0) ?? "·"}
                </div>
              )}
              <div className="min-w-0">
                <div
                  className="text-[12.5px] font-semibold truncate"
                  style={{ color: color.heading }}
                >
                  {operator.consultantName}
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: color.muted }}
                >
                  {operator.consultantRole || operator.companyName}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function CheckGlyph({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0 mt-0.5"
    >
      <circle cx="8" cy="8" r="7.25" stroke={color} strokeOpacity="0.32" strokeWidth="1.2" />
      <path
        d="M5 8.4 L7 10.4 L11 6.2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
