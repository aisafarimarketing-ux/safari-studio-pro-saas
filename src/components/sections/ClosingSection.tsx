"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import type {
  Section,
  Proposal,
  OperatorProfile,
  ClientDetails,
  TripDetails,
  PricingData,
  TierKey,
  ThemeTokens,
  ProposalTheme,
} from "@/lib/types";

// Closing — includes the merged closing-farewell variant (default) that
// also carries the branded footer, plus the four legacy editorial
// variants kept for backward compat.

export function ClosingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent, updateOperator } = useProposalStore();
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
    variant === "quote-led" ||
    variant === "cta-card";
  const variantHasSignOff =
    variant === "closing-farewell" ||
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
        <BookAndContactFooter
          proposal={proposal}
          operator={operator}
          client={client}
          trip={trip}
          pricing={pricing}
          activeTier={activeTier as TierKey}
          theme={theme}
          tokens={tokens}
          bg={tokens.sectionSurface}
          isEditor={isEditor}
          updateOperator={updateOperator}
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
        <BookAndContactFooter
          proposal={proposal}
          operator={operator}
          client={client}
          trip={trip}
          pricing={pricing}
          activeTier={activeTier as TierKey}
          theme={theme}
          tokens={tokens}
          bg={tokens.pageBg}
          isEditor={isEditor}
          updateOperator={updateOperator}
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
        <BookAndContactFooter
          proposal={proposal}
          operator={operator}
          client={client}
          trip={trip}
          pricing={pricing}
          activeTier={activeTier as TierKey}
          theme={theme}
          tokens={tokens}
          bg={tokens.sectionSurface}
          isEditor={isEditor}
          updateOperator={updateOperator}
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
      <BookAndContactFooter
        proposal={proposal}
        operator={operator}
        client={client}
        trip={trip}
        pricing={pricing}
        activeTier={activeTier as TierKey}
        theme={theme}
        tokens={tokens}
        bg={tokens.accent}
        isEditor={isEditor}
        updateOperator={updateOperator}
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

// ─── Shared Book + Contact footer ─────────────────────────────────────────
//
// Every closing variant renders this block at the bottom so the guest
// always has the same path to confirm / download / share / contact —
// regardless of which layout style the operator picked. Auto-flips text
// colours when the surrounding background is dark.

function BookAndContactFooter({
  proposal,
  operator,
  client,
  trip,
  pricing,
  activeTier,
  theme,
  tokens,
  bg,
  isEditor,
  updateOperator,
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
  isEditor: boolean;
  updateOperator: (patch: Partial<OperatorProfile>) => void;
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
      className="max-w-4xl mx-auto mt-16 md:mt-20 pt-12 grid md:grid-cols-2"
      style={{
        borderTop: `1px solid ${color.border}`,
        gap: 0,
      }}
    >
      {/* Book your Safari */}
      <div className="md:pr-10 md:border-r" style={{ borderColor: color.border }}>
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

      {/* Contact Us */}
      <div className="md:pl-10 mt-16 md:mt-0 text-left">
        <div
          className="text-[10.5px] uppercase tracking-[0.3em] font-bold mb-4"
          style={{ color: color.muted }}
        >
          Contact Us
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div
            className="shrink-0 w-14 h-14 rounded-full overflow-hidden"
            style={{ background: color.coverLift }}
          >
            {operator.consultantPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={operator.consultantPhoto}
                alt={operator.consultantName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-lg font-bold"
                style={{ color: color.accent }}
              >
                {operator.consultantName?.charAt(0) ?? "·"}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div
              className="text-[15px] font-semibold leading-tight"
              style={{
                color: color.heading,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
            >
              {operator.consultantName}
            </div>
            <div className="text-[12.5px] mt-0.5" style={{ color: color.muted }}>
              {operator.companyName}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-[92px_1fr] gap-y-2.5 text-[13px]">
          {(operator.address || isEditor) && (
            <>
              <dt className="font-semibold" style={{ color: color.heading }}>Address</dt>
              <dd
                className="outline-none whitespace-pre-line"
                style={{ color: color.body }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateOperator({
                    address: e.currentTarget.textContent?.trim() ?? operator.address ?? "",
                  })
                }
              >
                {operator.address || (isEditor ? "Street, city" : "")}
              </dd>
            </>
          )}
          {(operator.country || isEditor) && (
            <>
              <dt className="font-semibold" style={{ color: color.heading }}>Country</dt>
              <dd
                className="outline-none"
                style={{ color: color.body }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateOperator({
                    country: e.currentTarget.textContent?.trim() ?? operator.country ?? "",
                  })
                }
              >
                {operator.country || (isEditor ? "Country" : "")}
              </dd>
            </>
          )}
          {(operator.whatsapp || isEditor) && (
            <>
              <dt className="font-semibold" style={{ color: color.heading }}>WhatsApp</dt>
              <dd
                className="outline-none"
                style={{ color: color.body }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateOperator({
                    whatsapp: e.currentTarget.textContent?.trim() ?? operator.whatsapp ?? "",
                  })
                }
              >
                {operator.whatsapp || (isEditor ? "+1 555 …" : "")}
              </dd>
            </>
          )}
          <dt className="font-semibold" style={{ color: color.heading }}>Email</dt>
          <dd
            className="outline-none truncate"
            style={{ color: color.body }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updateOperator({
                email: e.currentTarget.textContent?.trim() ?? operator.email,
              })
            }
          >
            {operator.email || (isEditor ? "email@…" : "")}
          </dd>
        </dl>

        {(operator.website || isEditor) && (
          <a
            href={normaliseUrl(operator.website)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block text-[13px] font-semibold transition hover:opacity-80"
            style={{
              color: color.heading,
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Visit our website →
          </a>
        )}
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
