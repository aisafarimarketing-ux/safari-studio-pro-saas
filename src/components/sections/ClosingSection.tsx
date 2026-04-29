"use client";

import { useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import {
  type Section,
  type Proposal,
  type OperatorProfile,
} from "@/lib/types";

// ─── Closing — high-conversion design system ─────────────────────────────
//
// One container, one CTA system, seven layouts.
//
// Every variant shares the 960px sand card, identical typography, the
// same primary/secondary CTAs, and the same consultant card. Variants
// only differ in what they stack ABOVE / AROUND the conversion grid:
// a pull quote, an editorial letter, experience tiles, or nothing at
// all. This unifies brand voice across every closing while keeping the
// merchandising choice the editor exposes.
//
// Spec → exact pixel values for the core surfaces (no theme tokens),
// so the section reads the same regardless of operator theme. Keeps
// the moment of conversion brand-consistent across every proposal.

// ── Spec tokens ──────────────────────────────────────────────────────────
const SAND       = "#F7F5F2";
const SAND_LINE  = "#E5E5E5";
const FOREST     = "#1F3D2B";
const FOREST_DK  = "#172E20";
const HEADING    = "#111111";
const BODY       = "#444444";
const MUTED      = "#6B7280";
const BTN_BORDER = "#D1D5DB";
const BTN_TEXT   = "#333333";

// ─── Top-level dispatch ─────────────────────────────────────────────────

export function ClosingSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const variant = section.layoutVariant;

  const quote = (section.content.quote as string) ?? "";
  const signOff = (section.content.signOff as string) ?? "";
  const attribution = section.content.attribution as string | undefined;

  const onQuote = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { quote: e.currentTarget.textContent ?? quote });
  const onSignOff = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? signOff });
  const onAttribution = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, {
      attribution: e.currentTarget.textContent ?? attribution ?? "",
    });

  // AI write buttons. Every variant offers a sign-off rewrite (it backs the
  // description paragraph). Variants that surface a separate pull-quote
  // also offer the quote rewrite.
  const variantHasQuote =
    variant === "closing-farewell" ||
    variant === "quote-led" ||
    variant === "cta-card";

  const aiButtons = isEditor ? (
    <div
      className="absolute top-14 right-4 z-[35] flex items-center gap-2"
      data-editor-chrome
    >
      {variantHasQuote && (
        <AIWriteButton
          kind="closing-quote"
          currentText={quote}
          context={{
            clientName: proposal.client.guestNames,
            destinations: proposal.trip.destinations,
          }}
          onResult={(text) => updateSectionContent(section.id, { quote: text })}
          compact
        />
      )}
      <AIWriteButton
        kind="closing-signoff"
        currentText={signOff}
        context={{
          clientName: proposal.client.guestNames,
          consultantName: proposal.operator.consultantName,
        }}
        onResult={(text) => updateSectionContent(section.id, { signOff: text })}
        compact
      />
    </div>
  ) : null;

  const common = { proposal, section, isEditor, aiButtons } as const;

  switch (variant) {
    case "decision-card":
      return (
        <DecisionCardLayout
          {...common}
          signOff={signOff}
          onSignOff={onSignOff}
        />
      );
    case "closing-farewell":
      return (
        <FarewellLayout
          {...common}
          quote={quote}
          attribution={attribution}
          signOff={signOff}
          onQuote={onQuote}
          onSignOff={onSignOff}
          onAttribution={onAttribution}
        />
      );
    case "booking-recap":
      return <BookingRecapLayout {...common} signOff={signOff} onSignOff={onSignOff} />;
    case "quote-led":
      return (
        <QuoteLedLayout
          {...common}
          quote={quote}
          attribution={attribution}
          signOff={signOff}
          onQuote={onQuote}
          onSignOff={onSignOff}
          onAttribution={onAttribution}
        />
      );
    case "letter-style":
      return <LetterLayout {...common} signOff={signOff} onSignOff={onSignOff} />;
    case "centered-minimal":
      return <CenteredMinimalLayout {...common} signOff={signOff} onSignOff={onSignOff} />;
    case "cta-card":
      return <CtaCardLayout {...common} signOff={signOff} onSignOff={onSignOff} />;
    case "conversion-card":
      return <ConversionLayout {...common} signOff={signOff} onSignOff={onSignOff} />;
    default:
      return <DecisionCardLayout {...common} signOff={signOff} onSignOff={onSignOff} />;
  }
}

// ─── Shared building blocks ─────────────────────────────────────────────

function ClosingShell({
  pageBg,
  aiButtons,
  children,
}: {
  pageBg: string;
  aiButtons: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      // Outer bg defaults to SAND (cream) so the closing section reads
      // edge-to-edge cream out of the box, but the operator's
      // SectionChrome bg-picker can override via `pageBg` (resolved
      // from `sectionSurface` in pickPageBg above). Without this
      // override the bg picker silently failed — operators reported
      // changing closing bg with no visible effect.
      className="relative px-4 py-2 md:px-6 md:py-3"
      style={{
        background: pageBg || SAND,
        borderTop: `1px solid ${SAND_LINE}`,
      }}
    >
      {aiButtons}
      <div className="mx-auto" style={{ maxWidth: 960 }}>
        <div className="p-6 md:px-10 md:py-10">{children}</div>
      </div>
    </section>
  );
}

function TwoColGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[2fr_3fr]">{children}</div>
  );
}

function ConsultantCard({ operator }: { operator: OperatorProfile }) {
  const c = readConsultant(operator);
  return (
    <aside
      className="self-start"
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        padding: 20,
        border: `1px solid ${SAND_LINE}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      {c.photo ? (
        <div
          className="overflow-hidden"
          style={{ width: 48, height: 48, borderRadius: "50%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className="flex items-center justify-center font-semibold"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: FOREST,
            color: "#FFFFFF",
            fontSize: 16,
            letterSpacing: "0.2px",
          }}
          aria-hidden
        >
          {c.initial}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          fontSize: 16,
          fontWeight: 600,
          color: HEADING,
          lineHeight: 1.3,
        }}
      >
        {c.name}
      </div>
      <div
        style={{ marginTop: 4, fontSize: 14, color: MUTED, lineHeight: 1.4 }}
      >
        {c.role}
      </div>
      {c.contact && (
        <a
          href={c.contactHref}
          target={c.contactHref.startsWith("mailto:") ? undefined : "_blank"}
          rel={c.contactHref.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          className="block transition hover:opacity-80"
          style={{
            marginTop: 12,
            fontSize: 14,
            color: FOREST,
            fontWeight: 500,
            wordBreak: "break-word",
          }}
        >
          {c.contact}
        </a>
      )}
    </aside>
  );
}

function ConsultantInline({ operator }: { operator: OperatorProfile }) {
  const c = readConsultant(operator);
  return (
    <div className="flex items-center justify-center" style={{ gap: 14 }}>
      {c.photo ? (
        <div
          className="overflow-hidden shrink-0"
          style={{ width: 48, height: 48, borderRadius: "50%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className="flex items-center justify-center font-semibold shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: FOREST,
            color: "#FFFFFF",
            fontSize: 16,
          }}
          aria-hidden
        >
          {c.initial}
        </div>
      )}
      <div className="text-left">
        <div
          style={{ fontSize: 14, fontWeight: 600, color: HEADING, lineHeight: 1.3 }}
        >
          {c.name}
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>{c.role}</div>
        {c.contact && (
          <a
            href={c.contactHref}
            target={c.contactHref.startsWith("mailto:") ? undefined : "_blank"}
            rel={c.contactHref.startsWith("mailto:") ? undefined : "noopener noreferrer"}
            className="transition hover:opacity-80"
            style={{ fontSize: 12.5, color: FOREST, fontWeight: 500 }}
          >
            {c.contact}
          </a>
        )}
      </div>
    </div>
  );
}

function readConsultant(operator: OperatorProfile) {
  const name = operator.consultantName?.trim() || "Your consultant";
  const initial = name.charAt(0).toUpperCase();
  const role = operator.consultantRole?.trim() || "Your Safari Expert";
  const contact = operator.email || operator.whatsapp || operator.phone || "";
  const isEmail = !!operator.email && contact === operator.email;
  const isWhatsApp =
    !isEmail && !!operator.whatsapp && contact === operator.whatsapp;
  const contactHref = isEmail
    ? `mailto:${contact}`
    : isWhatsApp
      ? `https://wa.me/${contact.replace(/[^0-9]/g, "")}`
      : `tel:${contact.replace(/\s+/g, "")}`;
  return {
    name,
    initial,
    role,
    contact,
    contactHref,
    photo: operator.consultantPhoto,
  };
}

function PrimaryCta({
  href,
  label,
  invert = false,
}: {
  href: string;
  label: string;
  invert?: boolean;
}) {
  const bg = invert ? "#FFFFFF" : FOREST;
  const bgHover = invert ? "#F0EDE6" : FOREST_DK;
  const fg = invert ? FOREST : "#FFFFFF";
  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="group flex w-full items-center justify-center transition-colors"
      style={{
        height: 56,
        padding: "0 24px",
        borderRadius: 12,
        background: bg,
        color: fg,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "0.2px",
        boxShadow: invert
          ? "0 4px 12px rgba(0,0,0,0.25)"
          : "0 4px 12px rgba(0,0,0,0.15)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = bgHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bg;
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className="ml-2 transition-transform group-hover:translate-x-0.5"
        style={{ fontSize: 18, fontWeight: 500 }}
      >
        →
      </span>
    </motion.a>
  );
}

function SecondaryActions({
  proposalId,
  onRequestChanges,
  invert = false,
}: {
  proposalId: string;
  onRequestChanges: () => void;
  invert?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row" style={{ marginTop: 16, gap: 12 }}>
      <SecondaryButton invert={invert} onClick={onRequestChanges}>
        Request Changes
      </SecondaryButton>
      <SecondaryDownloadButton proposalId={proposalId} invert={invert} />
    </div>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled = false,
  invert = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  invert?: boolean;
}) {
  const border = invert ? "rgba(255,255,255,0.28)" : BTN_BORDER;
  const text = invert ? "rgba(255,255,255,0.92)" : BTN_TEXT;
  const hoverBg = invert ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.03)";
  const ringClass = invert
    ? "focus-visible:ring-white/30"
    : "focus-visible:ring-[#1F3D2B]/40";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center transition focus:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-65 ${ringClass}`}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        height: 44,
        padding: "0 16px",
        borderRadius: 10,
        background: "transparent",
        border: `1px solid ${border}`,
        color: text,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryDownloadButton({
  proposalId,
  invert = false,
}: {
  proposalId: string;
  invert?: boolean;
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
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SecondaryButton onClick={onClick} disabled={busy} invert={invert}>
      {busy ? "Preparing PDF…" : "Download Quote"}
    </SecondaryButton>
  );
}

// ── Conversion stack — headline + description + urgency + CTA + secondaries

function ConversionStack({
  section,
  proposal,
  isEditor,
  signOff,
  onSignOff,
  variantTone = "default",
  invert = false,
}: {
  section: Section;
  proposal: Proposal;
  isEditor: boolean;
  signOff: string;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
  variantTone?: "default" | "letter";
  invert?: boolean;
}) {
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const { trip, days, theme } = proposal;

  const country = deriveCountry(days, trip.destinations);
  const headline =
    (section.content.headline as string | undefined) ??
    (country ? `Your ${country} journey is ready` : "Your safari is ready");
  const description = signOff?.trim()
    ? signOff
    : "Hand-picked camps, drivers who know the ground, and a consultant on call from the moment you board to the moment you fly home.";
  const urgency =
    (section.content.urgency as string | undefined) ??
    "Availability at selected camps is limited and subject to confirmation.";
  const ctaLabel =
    (section.content.ctaLabel as string | undefined) ?? "Secure This Safari";

  const { confirmHref } = computeCta(proposal);

  const onHeadline = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, {
      headline: e.currentTarget.textContent ?? "",
    });
  const onUrgency = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, {
      urgency: e.currentTarget.textContent ?? "",
    });

  const headColor = invert ? "#FFFFFF" : HEADING;
  const bodyColor = invert ? "rgba(255,255,255,0.84)" : BODY;
  const mutedColor = invert ? "rgba(255,255,255,0.62)" : MUTED;

  return (
    <div className="min-w-0">
      <h2
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={onHeadline}
        className="outline-none"
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1.3,
          color: headColor,
          letterSpacing: "-0.01em",
          fontFamily: `'${theme.displayFont}', serif`,
        }}
      >
        {headline}
      </h2>
      <p
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={onSignOff}
        data-ai-editable="closing"
        className="outline-none"
        style={{
          marginTop: 12,
          marginBottom: 0,
          fontSize: 16,
          lineHeight: 1.6,
          color: bodyColor,
          whiteSpace: "pre-line",
          fontStyle: variantTone === "letter" ? "italic" : "normal",
        }}
      >
        {description}
      </p>
      <p
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={onUrgency}
        className="outline-none"
        style={{
          marginTop: 12,
          marginBottom: 0,
          fontSize: 14,
          color: mutedColor,
          lineHeight: 1.5,
        }}
      >
        {urgency}
      </p>
      <div style={{ marginTop: 28 }}>
        <PrimaryCta href={confirmHref} label={ctaLabel} invert={invert} />
      </div>
      <SecondaryActions
        proposalId={proposal.id}
        onRequestChanges={() => requestChangesPrefill(trip.title)}
        invert={invert}
      />
    </div>
  );
}

// ─── Variant 1: conversion-card (default) ───────────────────────────────

function ConversionLayout({
  proposal,
  section,
  isEditor,
  signOff,
  onSignOff,
  aiButtons,
}: VariantProps & {
  signOff: string;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  return (
    <ClosingShell pageBg={pickPageBg(section, proposal)} aiButtons={aiButtons}>
      <TwoColGrid>
        <ConsultantCard operator={proposal.operator} />
        <ConversionStack
          section={section}
          proposal={proposal}
          isEditor={isEditor}
          signOff={signOff}
          onSignOff={onSignOff}
        />
      </TwoColGrid>
    </ClosingShell>
  );
}

// ─── Variant 2: closing-farewell ────────────────────────────────────────
// Editorial pull-quote and attribution above, then the standard grid.

function FarewellLayout({
  proposal,
  section,
  isEditor,
  quote,
  signOff,
  attribution,
  onQuote,
  onSignOff,
  onAttribution,
  aiButtons,
}: VariantProps & {
  quote: string;
  signOff: string;
  attribution: string | undefined;
  onQuote: (e: React.FocusEvent<HTMLElement>) => void;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
  onAttribution: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  const fontFamily = `'${proposal.theme.displayFont}', serif`;
  return (
    <ClosingShell pageBg={pickPageBg(section, proposal)} aiButtons={aiButtons}>
      <div
        className="mx-auto text-center"
        style={{ maxWidth: 640, paddingBottom: 32 }}
      >
        <div
          aria-hidden
          style={{
            fontFamily,
            fontSize: 48,
            lineHeight: 0.7,
            color: FOREST,
            opacity: 0.45,
          }}
        >
          &ldquo;
        </div>
        <blockquote
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={onQuote}
          className="outline-none"
          style={{
            marginTop: 8,
            fontFamily,
            fontSize: "clamp(20px, 3vw, 26px)",
            fontWeight: 600,
            lineHeight: 1.3,
            color: HEADING,
            letterSpacing: "-0.005em",
          }}
        >
          {quote || "Africa changes you."}
        </blockquote>
        {(attribution || isEditor) && (
          <div
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={onAttribution}
            className="outline-none"
            style={{
              marginTop: 12,
              fontSize: 12,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {attribution || (isEditor ? "– Attribution" : "")}
          </div>
        )}
      </div>
      <div
        aria-hidden
        style={{
          height: 1,
          width: 80,
          background: SAND_LINE,
          margin: "0 auto 32px",
        }}
      />
      <TwoColGrid>
        <ConsultantCard operator={proposal.operator} />
        <ConversionStack
          section={section}
          proposal={proposal}
          isEditor={isEditor}
          signOff={signOff}
          onSignOff={onSignOff}
        />
      </TwoColGrid>
    </ClosingShell>
  );
}

// ─── Variant 3: booking-recap ───────────────────────────────────────────
// Eyebrow + destination chips + 4 day-image experience tiles, then grid.

function BookingRecapLayout({
  proposal,
  section,
  isEditor,
  signOff,
  onSignOff,
  aiButtons,
}: VariantProps & {
  signOff: string;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  const { trip, days } = proposal;
  const tiles = days
    .filter((d) => !!d.heroImageUrl)
    .slice(0, 4)
    .map((d) => ({
      id: d.id,
      label: d.destination || `Day ${d.dayNumber}`,
      url: d.heroImageUrl as string,
      objectPosition: d.heroImagePosition || "50% 50%",
    }));
  const destinations = trip.destinations ?? [];

  return (
    <ClosingShell pageBg={pickPageBg(section, proposal)} aiButtons={aiButtons}>
      <div style={{ paddingBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: MUTED,
            marginBottom: 12,
          }}
        >
          Itinerary at a glance
        </div>
        {destinations.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {destinations.map((d) => (
              <span
                key={d}
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: HEADING,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "#FFFFFF",
                  border: `1px solid ${SAND_LINE}`,
                }}
              >
                {d}
              </span>
            ))}
          </div>
        )}
        {tiles.length > 0 && (
          <div
            className="grid grid-cols-2 sm:grid-cols-4"
            style={{ gap: 10, marginTop: 20 }}
          >
            {tiles.map((t) => (
              <div
                key={t.id}
                className="relative overflow-hidden"
                style={{
                  aspectRatio: "4 / 5",
                  borderRadius: 10,
                  border: `1px solid ${SAND_LINE}`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.url}
                  alt={t.label}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: t.objectPosition }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.65) 100%)",
                  }}
                />
                <div
                  className="absolute left-2.5 right-2.5 bottom-2 text-white"
                  style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}
                >
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        aria-hidden
        style={{ height: 1, background: SAND_LINE, margin: "0 0 28px" }}
      />
      <TwoColGrid>
        <ConsultantCard operator={proposal.operator} />
        <ConversionStack
          section={section}
          proposal={proposal}
          isEditor={isEditor}
          signOff={signOff}
          onSignOff={onSignOff}
        />
      </TwoColGrid>
    </ClosingShell>
  );
}

// ─── Variant 4: quote-led ───────────────────────────────────────────────
// Oversized editorial pull-quote dominates the top, then the grid.

function QuoteLedLayout({
  proposal,
  section,
  isEditor,
  quote,
  attribution,
  signOff,
  onQuote,
  onSignOff,
  onAttribution,
  aiButtons,
}: VariantProps & {
  quote: string;
  signOff: string;
  attribution: string | undefined;
  onQuote: (e: React.FocusEvent<HTMLElement>) => void;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
  onAttribution: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  const fontFamily = `'${proposal.theme.displayFont}', serif`;
  return (
    <ClosingShell pageBg={pickPageBg(section, proposal)} aiButtons={aiButtons}>
      <div
        className="mx-auto text-center"
        style={{ maxWidth: 720, paddingBottom: 32 }}
      >
        <blockquote
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={onQuote}
          className="outline-none"
          style={{
            margin: 0,
            fontFamily,
            fontSize: "clamp(28px, 4.2vw, 40px)",
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
            color: HEADING,
          }}
        >
          {quote || "Africa changes you."}
        </blockquote>
        {(attribution || isEditor) && (
          <div
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={onAttribution}
            className="outline-none"
            style={{
              marginTop: 14,
              fontSize: 12,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {attribution || (isEditor ? "– Attribution" : "")}
          </div>
        )}
      </div>
      <div
        aria-hidden
        style={{ height: 1, background: SAND_LINE, margin: "0 0 28px" }}
      />
      <TwoColGrid>
        <ConsultantCard operator={proposal.operator} />
        <ConversionStack
          section={section}
          proposal={proposal}
          isEditor={isEditor}
          signOff={signOff}
          onSignOff={onSignOff}
        />
      </TwoColGrid>
    </ClosingShell>
  );
}

// ─── Variant 5: letter-style ────────────────────────────────────────────
// Standard 40/60 grid; the description is set in italic serif for letter mood.

function LetterLayout({
  proposal,
  section,
  isEditor,
  signOff,
  onSignOff,
  aiButtons,
}: VariantProps & {
  signOff: string;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  return (
    <ClosingShell pageBg={pickPageBg(section, proposal)} aiButtons={aiButtons}>
      <TwoColGrid>
        <ConsultantCard operator={proposal.operator} />
        <ConversionStack
          section={section}
          proposal={proposal}
          isEditor={isEditor}
          signOff={signOff}
          onSignOff={onSignOff}
          variantTone="letter"
        />
      </TwoColGrid>
    </ClosingShell>
  );
}

// ─── Variant 6: centered-minimal ────────────────────────────────────────
// Single centered column; consultant collapses into a horizontal mini below.

function CenteredMinimalLayout({
  proposal,
  section,
  isEditor,
  signOff,
  onSignOff,
  aiButtons,
}: VariantProps & {
  signOff: string;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const { trip, days, theme } = proposal;

  const country = deriveCountry(days, trip.destinations);
  const headline =
    (section.content.headline as string | undefined) ??
    (country ? `Your ${country} journey is ready` : "Your safari is ready");
  const description = signOff?.trim()
    ? signOff
    : "Hand-picked camps, drivers who know the ground, and a consultant on call from the moment you board to the moment you fly home.";
  const urgency =
    (section.content.urgency as string | undefined) ??
    "Availability at selected camps is limited and subject to confirmation.";
  const ctaLabel =
    (section.content.ctaLabel as string | undefined) ?? "Secure This Safari";

  const { confirmHref } = computeCta(proposal);

  const onHeadline = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, {
      headline: e.currentTarget.textContent ?? "",
    });
  const onUrgency = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, {
      urgency: e.currentTarget.textContent ?? "",
    });

  return (
    <ClosingShell pageBg={pickPageBg(section, proposal)} aiButtons={aiButtons}>
      <div className="mx-auto text-center" style={{ maxWidth: 540 }}>
        <h2
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={onHeadline}
          className="outline-none"
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.3,
            color: HEADING,
            letterSpacing: "-0.01em",
            fontFamily: `'${theme.displayFont}', serif`,
          }}
        >
          {headline}
        </h2>
        <p
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={onSignOff}
          data-ai-editable="closing"
          className="outline-none mx-auto"
          style={{
            marginTop: 12,
            fontSize: 16,
            lineHeight: 1.6,
            color: BODY,
            whiteSpace: "pre-line",
            maxWidth: 480,
          }}
        >
          {description}
        </p>
        <p
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={onUrgency}
          className="outline-none mx-auto"
          style={{
            marginTop: 12,
            fontSize: 14,
            color: MUTED,
            lineHeight: 1.5,
            maxWidth: 480,
          }}
        >
          {urgency}
        </p>
        <div style={{ marginTop: 28, maxWidth: 420, marginInline: "auto" }}>
          <PrimaryCta href={confirmHref} label={ctaLabel} />
        </div>
        <div style={{ maxWidth: 420, marginInline: "auto" }}>
          <SecondaryActions
            proposalId={proposal.id}
            onRequestChanges={() => requestChangesPrefill(trip.title)}
          />
        </div>
      </div>
      <div
        aria-hidden
        style={{
          height: 1,
          background: SAND_LINE,
          margin: "32px auto 0",
          maxWidth: 540,
        }}
      />
      <div style={{ marginTop: 24 }}>
        <ConsultantInline operator={proposal.operator} />
      </div>
    </ClosingShell>
  );
}

// ─── Variant 7: cta-card ────────────────────────────────────────────────
// 40/60 grid; the right column lives inside a forest-green emphasis card
// and runs in dark mode (white CTA + faint outline secondaries on dark).

function CtaCardLayout({
  proposal,
  section,
  isEditor,
  signOff,
  onSignOff,
  aiButtons,
}: VariantProps & {
  signOff: string;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  return (
    <ClosingShell pageBg={pickPageBg(section, proposal)} aiButtons={aiButtons}>
      <TwoColGrid>
        <ConsultantCard operator={proposal.operator} />
        <div
          style={{
            background: FOREST,
            color: "#FFFFFF",
            borderRadius: 14,
            padding: 28,
            boxShadow: "0 18px 48px -16px rgba(0,0,0,0.45)",
          }}
        >
          <ConversionStack
            section={section}
            proposal={proposal}
            isEditor={isEditor}
            signOff={signOff}
            onSignOff={onSignOff}
            invert
          />
        </div>
      </TwoColGrid>
    </ClosingShell>
  );
}

// ─── Variant 8: decision-card (new default) ─────────────────────────────
//
// The conversion module — not a section.
//
// Forest-green canvas, 60/40 split. Left: emotional headline + body +
// gold-accented urgency box. Right: white decision card with full-
// width gradient CTA, OR-divider, secondary actions, trust indicators,
// and human-proof signature. A single horizontal contact strip pinned
// at the bottom of the dark canvas — replaces the standalone
// FooterSection for proposals that use this variant (operators can
// remove the FooterSection from the section list when they switch).

const DC_DARK    = "#0d2620"; // section background top
const DC_DARKER  = "#0a1d18"; // section background bottom
const DC_FOREST  = "#1F3D2B";
const DC_FOREST2 = "#2F6F4E";
const DC_GOLD    = "#C7A76C";
const DC_LINE    = "rgba(255,255,255,0.10)";

function DecisionCardLayout({
  proposal, section, isEditor, signOff, onSignOff, aiButtons,
}: VariantProps & {
  signOff: string;
  onSignOff: (e: React.FocusEvent<HTMLElement>) => void;
}) {
  const updateSectionContent = useProposalStore((s) => s.updateSectionContent);
  const { operator, trip, client, days, theme, activeTier, pricing } = proposal;

  const country = deriveCountry(days, trip.destinations);
  const headline =
    (section.content.headline as string | undefined) ??
    `Your ${country || "safari"} is ready — all that's left is your confirmation.`;
  const body = signOff?.trim()
    ? signOff
    : "We've secured the camps, mapped every route, and prepared everything for your journey. This is your moment to lock it in.";
  const urgency =
    (section.content.urgency as string | undefined) ??
    "Availability is limited — we recommend confirming within 48 hours.";
  const ctaLabel = (section.content.ctaLabel as string | undefined) ?? "Secure Your Safari →";
  const ctaSubtext =
    (section.content.ctaSubtext as string | undefined) ?? "Secure booking · No payment today";
  const proofTitle =
    (section.content.proofTitle as string | undefined) ?? "Your safari, personally managed";
  const proofBody =
    (section.content.proofBody as string | undefined) ?? "We're with you from planning to arrival.";

  const { confirmHref } = computeCta(proposal);

  const onHeadline = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { headline: e.currentTarget.textContent ?? "" });
  const onUrgency = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { urgency: e.currentTarget.textContent ?? "" });
  const onProofTitle = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { proofTitle: e.currentTarget.textContent ?? "" });
  const onProofBody = (e: React.FocusEvent<HTMLElement>) =>
    updateSectionContent(section.id, { proofBody: e.currentTarget.textContent ?? "" });

  const trustBadges = (operator.trustBadges && operator.trustBadges.length > 0)
    ? operator.trustBadges
    : ["No-risk adjustments", "Fast confirmations", "Dedicated support"];

  const consultantName = operator.consultantName?.trim() || "Your consultant";
  const consultantInitial = consultantName.charAt(0).toUpperCase();
  const companyName = operator.companyName?.trim() || "Safari Studio";
  const consultantRole = operator.consultantRole?.trim() || "Your Safari Expert";
  const signatureName = `${consultantName} & Team`;

  const requestChanges = () => requestChangesPrefill(trip.title);

  // Page bg behind the section — we use the default proposal page bg
  // unless the operator overrides via styleOverrides.
  const overrides = section.styleOverrides as Record<string, string> | undefined;
  const pageBg = overrides?.pageBg ?? proposal.theme.tokens.pageBg ?? "#ffffff";

  return (
    <section
      className="relative py-2 md:py-3"
      style={{ background: pageBg }}
    >
      {aiButtons}

      <div
        className="relative overflow-hidden"
        style={{
          maxWidth: "100%",
          background: `linear-gradient(180deg, ${DC_DARK}, ${DC_DARKER})`,
          boxShadow: "0 32px 80px -24px rgba(0,0,0,0.42)",
        }}
      >
        {/* Decorative grain — gold dot pattern, very faint */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${DC_GOLD} 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative px-6 py-10 md:px-12 md:py-14">
          {/* ── Two-column body ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10 lg:gap-12 items-start">
            {/* LEFT — emotional hook */}
            <div className="min-w-0">
              <h2
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={onHeadline}
                className="outline-none"
                style={{
                  margin: 0,
                  fontFamily: `'${theme.displayFont}', serif`,
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 600,
                  lineHeight: 1.12,
                  letterSpacing: "-0.012em",
                  color: "#ffffff",
                }}
              >
                {headline}
              </h2>
              <p
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={onSignOff}
                data-ai-editable="closing"
                className="outline-none"
                style={{
                  marginTop: 20,
                  marginBottom: 0,
                  fontSize: 17,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.78)",
                  whiteSpace: "pre-line",
                }}
              >
                {body}
              </p>

              {/* Urgency box */}
              <div
                className="flex items-start gap-3"
                style={{
                  marginTop: 28,
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "rgba(199,167,108,0.08)",
                  border: `1px solid ${DC_GOLD}52`,
                }}
              >
                <ClockIcon color={DC_GOLD} />
                <p
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={onUrgency}
                  className="outline-none"
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: DC_GOLD,
                    fontWeight: 500,
                  }}
                >
                  {urgency}
                </p>
              </div>
            </div>

            {/* RIGHT — Decision card */}
            <div
              className="rounded-2xl"
              style={{
                background: "#FFFFFF",
                padding: "32px 32px 28px",
                boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
              }}
            >
              {/* Primary CTA */}
              <a
                href={confirmHref}
                className="group flex w-full items-center justify-center transition-transform"
                style={{
                  height: 64,
                  borderRadius: 14,
                  background: `linear-gradient(180deg, ${DC_FOREST}, ${DC_FOREST2})`,
                  color: "#ffffff",
                  fontSize: 16.5,
                  fontWeight: 600,
                  letterSpacing: "0.2px",
                  boxShadow: "0 10px 30px rgba(31,61,43,0.28)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {ctaLabel}
              </a>
              <div
                className="mt-2.5 text-center"
                style={{ fontSize: 11.5, color: "rgba(13,38,32,0.55)" }}
              >
                {ctaSubtext}
              </div>

              {/* OR divider */}
              <div className="flex items-center gap-3" style={{ margin: "22px 0 16px" }}>
                <div className="flex-1" style={{ height: 1, background: "rgba(13,38,32,0.10)" }} />
                <span
                  className="text-[10px] font-bold uppercase tabular-nums"
                  style={{ letterSpacing: "0.24em", color: "rgba(13,38,32,0.35)" }}
                >
                  Or
                </span>
                <div className="flex-1" style={{ height: 1, background: "rgba(13,38,32,0.10)" }} />
              </div>

              {/* Secondary buttons */}
              <div className="grid grid-cols-2" style={{ gap: 12 }}>
                <button
                  type="button"
                  onClick={requestChanges}
                  className="flex items-center justify-center transition hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3D2B]/40"
                  style={{
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 10,
                    background: "transparent",
                    border: "1px solid rgba(13,38,32,0.16)",
                    color: "rgba(13,38,32,0.78)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Request Changes
                </button>
                <DecisionDownloadBtn proposalId={proposal.id} />
              </div>

              {/* Trust indicators */}
              <ul className="flex flex-wrap items-center" style={{ marginTop: 22, gap: "6px 14px" }}>
                {trustBadges.slice(0, 4).map((b, i) => (
                  <li
                    key={`${i}-${b.slice(0, 12)}`}
                    className="flex items-center gap-1.5 text-[11.5px] font-medium"
                    style={{ color: "rgba(13,38,32,0.62)" }}
                  >
                    <CheckBadge color={DC_FOREST2} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {/* Human proof */}
              <div
                className="flex items-start gap-3"
                style={{
                  marginTop: 22,
                  paddingTop: 22,
                  borderTop: "1px solid rgba(13,38,32,0.08)",
                }}
              >
                <AvatarGroup
                  primaryUrl={operator.consultantPhoto}
                  primaryInitial={consultantInitial}
                />
                <div className="min-w-0">
                  <div
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={onProofTitle}
                    className="outline-none"
                    style={{ fontSize: 13, fontWeight: 600, color: "#0d2620", lineHeight: 1.3 }}
                  >
                    {proofTitle}
                  </div>
                  <div
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={onProofBody}
                    className="outline-none"
                    style={{ fontSize: 11.5, color: "rgba(13,38,32,0.58)", marginTop: 2, lineHeight: 1.4 }}
                  >
                    {proofBody}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(13,38,32,0.58)",
                      marginTop: 6,
                      fontStyle: "italic",
                    }}
                  >
                    — {signatureName} · {companyName}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Contact strip ───────────────────────────────────────── */}
          <ContactStrip
            companyName={companyName}
            consultantInitial={consultantInitial}
            consultantPhoto={operator.consultantPhoto}
            roleLabel={consultantRole}
            email={operator.email}
            phone={operator.phone}
            whatsapp={operator.whatsapp}
            website={operator.website}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Decision-card sub-pieces ───────────────────────────────────────────

function DecisionDownloadBtn({ proposalId }: { proposalId: string }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/proposals/${proposalId}/pdf`, { method: "POST" });
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
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center justify-center transition hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3D2B]/40 disabled:cursor-wait disabled:opacity-65"
      style={{
        height: 44,
        padding: "0 14px",
        borderRadius: 10,
        background: "transparent",
        border: "1px solid rgba(13,38,32,0.16)",
        color: "rgba(13,38,32,0.78)",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {busy ? "Preparing…" : "Download Quote"}
    </button>
  );
}

function AvatarGroup({
  primaryUrl, primaryInitial,
}: {
  primaryUrl?: string;
  primaryInitial: string;
}) {
  const palette = [`${DC_FOREST}`, `${DC_FOREST2}`, "#5a7a66"];
  return (
    <div className="flex items-center shrink-0" style={{ height: 32 }}>
      {/* Primary — operator's consultant photo or initial chip */}
      {primaryUrl ? (
        <div
          className="rounded-full overflow-hidden shrink-0"
          style={{ width: 32, height: 32, border: "2px solid white" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={primaryUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          className="rounded-full flex items-center justify-center shrink-0"
          style={{
            width: 32, height: 32,
            background: palette[0],
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            border: "2px solid white",
          }}
        >
          {primaryInitial}
        </div>
      )}
      {/* Two soft team chips overlapping */}
      <div
        className="rounded-full shrink-0"
        style={{
          width: 32, height: 32,
          background: `linear-gradient(135deg, ${palette[1]}, ${palette[2]})`,
          marginLeft: -10,
          border: "2px solid white",
        }}
        aria-hidden
      />
      <div
        className="rounded-full shrink-0"
        style={{
          width: 32, height: 32,
          background: `linear-gradient(135deg, ${palette[2]}, ${palette[0]})`,
          marginLeft: -10,
          border: "2px solid white",
        }}
        aria-hidden
      />
    </div>
  );
}

function ContactStrip({
  companyName, consultantInitial, consultantPhoto, roleLabel,
  email, phone, whatsapp, website,
}: {
  companyName: string;
  consultantInitial: string;
  consultantPhoto?: string;
  roleLabel: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
}) {
  return (
    <div
      className="flex items-center justify-between flex-wrap gap-5"
      style={{
        marginTop: 40,
        paddingTop: 28,
        borderTop: `1px solid ${DC_LINE}`,
      }}
    >
      {/* Left — brand mini-block */}
      <div className="flex items-center gap-3 min-w-0">
        {consultantPhoto ? (
          <div
            className="rounded-full overflow-hidden shrink-0"
            style={{ width: 40, height: 40 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={consultantPhoto} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            className="rounded-full flex items-center justify-center shrink-0 font-bold"
            style={{
              width: 40, height: 40,
              background: `linear-gradient(135deg, ${DC_FOREST}, ${DC_FOREST2})`,
              color: DC_GOLD,
              fontSize: 16,
            }}
            aria-hidden
          >
            {consultantInitial}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[14px] font-semibold leading-tight truncate" style={{ color: "white" }}>
            {companyName}
          </div>
          <div className="text-[11.5px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
            {roleLabel}
          </div>
        </div>
      </div>

      {/* Right — pill rail */}
      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        {whatsapp && (
          <ContactPill
            href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
            label="WhatsApp"
            icon={<WhatsAppGlyph />}
          />
        )}
        {email && (
          <ContactPill
            href={`mailto:${email}`}
            label="Email"
            icon={<MailGlyph />}
          />
        )}
        {phone && (
          <ContactPill
            href={`tel:${phone.replace(/\s+/g, "")}`}
            label="Phone"
            icon={<PhoneGlyph />}
          />
        )}
        {website && (
          <ContactPill
            href={normaliseUrl(website)}
            label="Website"
            icon={<GlobeGlyph />}
            external
          />
        )}
      </div>
    </div>
  );
}

function ContactPill({
  href, label, icon, external = false,
}: {
  href: string; label: string; icon: React.ReactNode; external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-2 transition"
      style={{
        height: 36,
        padding: "0 14px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.92)",
        fontSize: 12.5,
        fontWeight: 500,
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.10)";
        e.currentTarget.style.borderColor = "rgba(199,167,108,0.36)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
      }}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

// ─── Tiny icons ──────────────────────────────────────────────────────────

function ClockIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5 V8 L10.5 9.5" />
    </svg>
  );
}
function CheckBadge({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke={color} strokeOpacity="0.42" strokeWidth="1.2" />
      <path d="M5 8.4 L7 10.4 L11 6.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function WhatsAppGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4L3 21" />
      <path d="M9 10a3 3 0 0 0 3 3l1.5-1.5a1 1 0 0 1 1 0l2 1.3a1 1 0 0 1 .3 1.2l-.3.6a3 3 0 0 1-3 2" />
    </svg>
  );
}
function MailGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 4.5 L8 9 L13.5 4.5" />
    </svg>
  );
}
function PhoneGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.2 4.5 a1.5 1.5 0 0 1 1.5-1.5h1.4a1 1 0 0 1 1 .8l.4 2.2a1 1 0 0 1-.3 1l-1.1 1.1a8 8 0 0 0 4.2 4.2l1.1-1.1a1 1 0 0 1 1-.3l2.2.4a1 1 0 0 1 .8 1v1.4a1.5 1.5 0 0 1-1.5 1.5C7.6 14 3 9.4 3.2 4.5z" />
    </svg>
  );
}
function GlobeGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8 H14" />
      <path d="M8 2 a8 8 0 0 1 0 12" />
      <path d="M8 2 a8 8 0 0 0 0 12" />
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

type VariantProps = {
  proposal: Proposal;
  section: Section;
  isEditor: boolean;
  aiButtons: React.ReactNode;
};

function pickPageBg(section: Section, proposal: Proposal): string {
  // Operators recolour the closing section via SectionChrome's bg
  // picker, which writes to `sectionSurface` (the standard override
  // path used by every other section). The closing originally
  // ignored that and ran on a hardcoded SAND constant — operators
  // reported the bg picker had no effect. Resolve order:
  //   1. sectionSurface override (what the bg picker writes)
  //   2. legacy pageBg override (kept for proposals that wrote here)
  //   3. theme defaults
  //   4. white as a safety net
  const overrides = section.styleOverrides as Record<string, string> | undefined;
  return (
    overrides?.sectionSurface ??
    overrides?.pageBg ??
    proposal.theme.tokens.sectionSurface ??
    proposal.theme.tokens.pageBg ??
    "#ffffff"
  );
}

function requestChangesPrefill(tripTitle?: string) {
  if (typeof window === "undefined") return;
  const message = `I'd like to discuss some changes to the proposal for ${
    tripTitle || "this safari"
  }.`;
  window.dispatchEvent(
    new CustomEvent("ss:prefillComment", { detail: { message } }),
  );
}

function computeCta(proposal: Proposal): { confirmHref: string; totalLabel: string } {
  const { operator, client, activeTier, pricing } = proposal;
  const tierKey = activeTier as keyof typeof pricing;
  const tier =
    tierKey === "classic" || tierKey === "premier" || tierKey === "signature"
      ? pricing[tierKey]
      : null;
  const pax = parsePax(client.pax);
  const totalLabel = buildTotalLabel(
    tier?.pricePerPerson ?? "",
    tier?.currency ?? "USD",
    pax,
  );
  const confirmHref = resolveBookingHref(operator, proposal, totalLabel);
  return { confirmHref, totalLabel };
}

// Country derivation for the headline default. Prefers `days[].country`
// (set by the AI autopilot per day) and falls back to a small destination
// → country lookup that covers East Africa. Returns "" when nothing
// matches; the caller renders a generic headline.
function deriveCountry(
  days: Proposal["days"],
  destinations: string[] | undefined,
): string {
  const fromDays = days.find((d) => d.country?.trim())?.country?.trim();
  if (fromDays) return fromDays;

  const dests = (destinations ?? []).map((d) => d.toLowerCase());
  if (dests.length === 0) return "";

  const TZ = ["serengeti","ngorongoro","tarangire","manyara","arusha","zanzibar","selous","nyerere","ruaha","mahale","katavi","pemba","mafia"];
  const KE = ["mara","amboseli","samburu","laikipia","nairobi","lamu","diani","tsavo","ol pejeta","lewa","meru","naivasha","nakuru"];
  const UG = ["bwindi","queen elizabeth","murchison","kibale","kidepo"];
  const RW = ["volcanoes","akagera","nyungwe","kigali"];

  const matches = (list: string[]) =>
    dests.some((d) => list.some((token) => d.includes(token)));

  if (matches(TZ)) return "Tanzania";
  if (matches(KE)) return "Kenya";
  if (matches(UG)) return "Uganda";
  if (matches(RW)) return "Rwanda";
  return "";
}

function parsePax(raw: string | undefined): number {
  if (!raw) return 0;
  const nums = raw.match(/\d+/g);
  if (!nums) return 0;
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
    if (total < 20 && num <= 12) {
      total += num;
      break;
    }
    break;
  }
  return total;
}

function buildTotalLabel(
  perPerson: string,
  currency: string,
  pax: number,
): string {
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
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function resolveBookingHref(
  operator: { bookingUrl?: string; website?: string; email?: string },
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
