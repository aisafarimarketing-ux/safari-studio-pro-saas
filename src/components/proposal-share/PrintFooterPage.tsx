"use client";

import type { Proposal, ThemeTokens } from "@/lib/types";
import { PrintSectionHeader } from "./PrintSectionHeader";

// ─── Print: full-page editorial contact card ─────────────────────────────
//
// On-screen FooterSection is short on purpose — a tight contact strip
// at the very bottom of the proposal. In a printed deck that lands on
// its own A4 page, that same strip leaves 87% of the page empty
// ("Contact (13%)" in the underfill report). This component replaces
// the on-screen footer for print only: a full-A4 closing card that
// reads as the deliberate last page of the deck.
//
// Layout:
//   ─── thin hairline ────────────────────────────────
//   "TO BOOK / TO ASK A QUESTION"            (eyebrow)
//   Reach out to Amina                        (h1, display serif)
//
//        ┌─ COMPANY block ───────┬─ CONTACT block ─────┐
//        │  Operator name        │  Email · Phone      │
//        │  Tagline              │  WhatsApp           │
//        │  Tagline2             │  Web                │
//        ├─ ADDRESS ─────────────┼─ NEXT STEPS ────────┤
//        │  Address line(s)      │  Numbered guidance  │
//        └───────────────────────┴─────────────────────┘
//
//   Closing line + signature                 (centered, italic)

export function PrintFooterPage({ proposal }: { proposal: Proposal }) {
  const { operator, theme } = proposal;
  const tokens = proposal.theme.tokens as ThemeTokens;

  const consultantName = operator.consultantName?.trim() || "us";
  const company = operator.companyName?.trim() || "";
  const email = operator.email?.trim() || "";
  const phone = operator.phone?.trim() || "";
  const whatsapp = operator.whatsapp?.trim() || "";
  const website = operator.website?.trim() || "";

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: tokens.pageBg, color: tokens.bodyText }}
    >
      <PrintSectionHeader
        eyebrow="To book · To ask a question"
        title={`Reach out to ${consultantName}`}
        subtitle={
          company
            ? `Speak with ${company} when you're ready — we'll hold these arrangements while you decide.`
            : undefined
        }
        theme={theme}
        tokens={tokens}
        padded
      />

      {/* Two-column body — operator info on the left, contact methods
          on the right. Each column has two rows so the page fills its
          height intentionally rather than ending after one band. */}
      <div className="flex-1 min-h-0 px-12 pt-6 pb-10 grid grid-cols-2 gap-x-12 gap-y-6">
        {/* Top-left — operator identity */}
        <section>
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-2"
            style={{ color: tokens.mutedText }}
          >
            About us
          </div>
          <div
            className="text-[18px] font-bold leading-[1.15] mb-2"
            style={{
              color: tokens.headingText,
              fontFamily: `'${theme.displayFont}', serif`,
              letterSpacing: "-0.012em",
            }}
          >
            {company || "Your operator"}
          </div>
          <p
            className="text-[12.5px] leading-[1.7]"
            style={{ color: tokens.bodyText }}
          >
            We design private safari journeys across East Africa. Every
            proposal is hand-built from the camps and routes we trust —
            no copy-paste itineraries.
          </p>
        </section>

        {/* Top-right — primary contact */}
        <section>
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Direct line
          </div>
          <ul className="space-y-2.5">
            {email && (
              <ContactRow label="Email" value={email} tokens={tokens} />
            )}
            {phone && (
              <ContactRow label="Phone" value={phone} tokens={tokens} />
            )}
            {whatsapp && (
              <ContactRow label="WhatsApp" value={whatsapp} tokens={tokens} />
            )}
            {website && (
              <ContactRow label="Web" value={website} tokens={tokens} />
            )}
          </ul>
        </section>

        {/* Bottom-left — addresses / hours / signature line */}
        <section>
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-2"
            style={{ color: tokens.mutedText }}
          >
            Office
          </div>
          <div
            className="text-[12.5px] leading-[1.7]"
            style={{ color: tokens.bodyText }}
          >
            {company ? `${company} ·` : ""} East Africa
            <br />
            Available Monday–Saturday
          </div>
        </section>

        {/* Bottom-right — next steps */}
        <section>
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Next steps
          </div>
          <ol className="space-y-2 text-[12.5px] leading-[1.6]" style={{ color: tokens.bodyText }}>
            <li className="flex gap-2">
              <span style={{ color: tokens.accent, fontWeight: 600 }}>01</span>
              <span>Confirm dates &amp; preferred camps</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: tokens.accent, fontWeight: 600 }}>02</span>
              <span>30% deposit secures your bookings</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: tokens.accent, fontWeight: 600 }}>03</span>
              <span>We send the final dossier 30 days before travel</span>
            </li>
          </ol>
        </section>
      </div>

      {/* Footer hairline — closes the deck. */}
      <div
        className="px-12 pb-8 pt-4 text-center"
        style={{ borderTop: `1px solid ${tokens.border}` }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.32em] font-semibold mb-2"
          style={{ color: tokens.mutedText }}
        >
          Signed
        </div>
        <div
          className="text-[16px] italic"
          style={{
            color: tokens.headingText,
            fontFamily: `'${theme.displayFont}', serif`,
          }}
        >
          {consultantName}
          {company ? `, ${company}` : ""}
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  label, value, tokens,
}: {
  label: string;
  value: string;
  tokens: ThemeTokens;
}) {
  return (
    <li className="flex items-baseline gap-3">
      <span
        className="text-[9px] uppercase tracking-[0.26em] font-semibold w-16 shrink-0"
        style={{ color: tokens.mutedText }}
      >
        {label}
      </span>
      <span
        className="text-[12.5px] font-medium break-words"
        style={{ color: tokens.headingText }}
      >
        {value}
      </span>
    </li>
  );
}
