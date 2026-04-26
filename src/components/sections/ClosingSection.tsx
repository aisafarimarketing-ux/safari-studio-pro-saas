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
    default:
      return <ConversionLayout {...common} signOff={signOff} onSignOff={onSignOff} />;
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
      className="relative px-4 py-10 md:px-6 md:py-14"
      style={{ background: pageBg }}
    >
      {aiButtons}
      <div
        className="mx-auto"
        style={{
          maxWidth: 960,
          background: SAND,
          borderRadius: 16,
          border: `1px solid ${SAND_LINE}`,
        }}
      >
        <div className="p-6 md:px-10 md:py-12">{children}</div>
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

// ─── Helpers ────────────────────────────────────────────────────────────

type VariantProps = {
  proposal: Proposal;
  section: Section;
  isEditor: boolean;
  aiButtons: React.ReactNode;
};

function pickPageBg(section: Section, proposal: Proposal): string {
  const overrides = section.styleOverrides as Record<string, string> | undefined;
  return overrides?.pageBg ?? proposal.theme.tokens.pageBg ?? "#ffffff";
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
