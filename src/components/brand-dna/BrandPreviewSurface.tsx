"use client";

import { useEffect, useState } from "react";
import type { Proposal } from "@/lib/types";
import type { BrandDNAForm } from "./types";

// ─── Live Brand Preview ───────────────────────────────────────────────────
//
// Renders a focused preview of what an org's brand will look like on a
// real proposal — without touching the database. Reads:
//
//   1. The base proposal (loaded once on mount via
//      /api/brand-dna/preview-source — priority: master template →
//      most recent → demo fallback).
//   2. The admin's CURRENT form state (passed in as `form` prop).
//
// Mutates a copy of the base proposal in memory using `form` and
// re-renders on every form-state change. Saving Brand DNA is a
// separate flow (existing PUT /api/brand-dna) — this surface is
// purely visual.
//
// Why a focused preview rather than the full share view?
//   • The full share view reads from a global Zustand store that's
//     also used by the editor. Hijacking it for a preview risks
//     leaking the synthetic proposal into other tabs / surfaces.
//   • A focused surface that shows the brand-relevant pieces (cover
//     + a day card + pricing snippet + greeting / signoff) is
//     enough for the spec ("preview should reflect logo, colors,
//     fonts, backgrounds, section colors, greeting, signoff,
//     signature") without touching the global store.

type PreviewSource = "master" | "recent" | "fallback";

type SourceResponse = {
  source: PreviewSource;
  proposal: Proposal;
  proposalRef: { id: string; title: string } | null;
};

type Loaded =
  | { state: "loading" }
  | { state: "ready"; data: SourceResponse }
  | { state: "error"; message: string };

export function BrandPreviewSurface({ form }: { form: BrandDNAForm }) {
  const [data, setData] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brand-dna/preview-source", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as SourceResponse;
        if (!cancelled) setData({ state: "ready", data: body });
      } catch (err) {
        if (!cancelled) {
          setData({
            state: "error",
            message:
              err instanceof Error
                ? err.message
                : "Couldn't load a preview proposal.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (data.state === "loading") {
    return (
      <PreviewShell>
        <div className="text-[12px] opacity-50">Loading preview…</div>
      </PreviewShell>
    );
  }
  if (data.state === "error") {
    return (
      <PreviewShell>
        <div className="text-[12px] text-red-700">{data.message}</div>
      </PreviewShell>
    );
  }

  // Compute brand-derived visual values from the form. Falls back to
  // base proposal values when the form field is empty.
  const baseProposal = data.data.proposal;
  const baseTier =
    baseProposal.activeTier &&
    ["classic", "premier", "signature"].includes(baseProposal.activeTier)
      ? baseProposal.activeTier
      : "premier";
  const accent = pickColor(form.brandColors, "primary", 0)
    ?? baseProposal.theme?.tokens?.accent
    ?? "#1b3a2d";
  const secondary = pickColor(form.brandColors, "secondary", 1)
    ?? baseProposal.theme?.tokens?.secondaryAccent
    ?? "#c9a84c";
  const bodyFontStack = fontStack(form.bodyFont, baseProposal.theme?.bodyFont);
  const headingFontStack = fontStack(
    form.headingFont,
    baseProposal.theme?.displayFont,
  );
  const brandName = form.brandName.trim() || baseProposal.operator?.companyName || "Your safari brand";
  const tagline = form.tagline.trim() || "";
  const logoUrl = form.logoUrl.trim() || baseProposal.operator?.logoUrl || "";

  const sampleDay = baseProposal.days?.[0] ?? null;
  const sampleAccommodation =
    sampleDay?.tiers?.[baseTier as "classic" | "premier" | "signature"];
  const sampleClientName =
    baseProposal.client?.guestNames?.split(/\s+/)[0]?.trim() || "Lilian";
  const sampleOperatorFirstName =
    baseProposal.operator?.consultantName?.split(/\s+/)[0]?.trim() || "Mary";

  // Format expansion for the demo greeting / signoff lines. Same
  // semantics as applyBrandTemplate in lib/executionFormat — kept
  // duplicated here because importing from a server-only module
  // into a client component would pull the whole formatter chain.
  const greetingDemo = form.greetingFormat
    ? expandTemplate(form.greetingFormat, {
        firstName: sampleClientName,
        operatorFirstName: sampleOperatorFirstName,
      })
    : `Hi ${sampleClientName} —`;
  const signoffDemo = form.signoffFormat
    ? expandTemplate(form.signoffFormat, {
        operatorFirstName: sampleOperatorFirstName,
      })
    : `— ${sampleOperatorFirstName}`;

  const sourceLabel = sourceLabelFor(data.data);

  return (
    <PreviewShell sourceLabel={sourceLabel}>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(10,20,17,0.08)",
          fontFamily: bodyFontStack,
          color: "#0a1411",
        }}
      >
        {/* Cover */}
        <div
          className="px-5 py-6"
          style={{
            background: accent,
            color: "#F7F3E8",
          }}
        >
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  objectFit: "contain",
                  background: "rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  padding: 4,
                }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: secondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0a1411",
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: headingFontStack,
                }}
              >
                {(brandName[0] || "S").toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div
                style={{
                  fontFamily: headingFontStack,
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: "-0.005em",
                }}
              >
                {brandName}
              </div>
              {tagline && (
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.8,
                    marginTop: 2,
                  }}
                >
                  {tagline}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: headingFontStack,
              fontSize: 22,
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            {baseProposal.metadata?.title ?? baseProposal.trip?.title ?? "Your trip"}
          </div>
          {baseProposal.trip?.dates && (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
              {baseProposal.trip.dates}
            </div>
          )}
        </div>

        {/* Day card */}
        {sampleDay && (
          <div
            className="px-5 py-4"
            style={{
              borderTop: `2px solid ${secondary}`,
              background: "#F7F3E8",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: secondary,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Day {sampleDay.dayNumber}
            </div>
            <div
              style={{
                fontFamily: headingFontStack,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.005em",
              }}
            >
              {sampleDay.destination}
            </div>
            <p
              style={{
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "rgba(10,20,17,0.75)",
                marginTop: 6,
              }}
            >
              {truncate(stripHtml(sampleDay.description ?? ""), 220)}
            </p>
            {sampleAccommodation?.camp && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11.5,
                  color: "rgba(10,20,17,0.6)",
                }}
              >
                <strong style={{ color: "#0a1411" }}>Stay:</strong>{" "}
                {sampleAccommodation.camp}
                {sampleAccommodation.location
                  ? ` (${sampleAccommodation.location})`
                  : ""}
              </div>
            )}
          </div>
        )}

        {/* Pricing summary */}
        <div
          className="px-5 py-4"
          style={{
            borderTop: "1px solid rgba(10,20,17,0.08)",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(10,20,17,0.5)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Pricing snapshot
          </div>
          {(() => {
            const tier = baseProposal.pricing?.[
              baseTier as "classic" | "premier" | "signature"
            ];
            const price = tier?.pricePerPerson?.trim() || "—";
            const currency = tier?.currency?.trim() || "USD";
            return (
              <div
                style={{
                  fontFamily: headingFontStack,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                }}
              >
                {currency} {price}{" "}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(10,20,17,0.6)",
                    fontFamily: bodyFontStack,
                  }}
                >
                  per person
                </span>
              </div>
            );
          })()}
          <div
            style={{
              marginTop: 8,
              fontSize: 11.5,
              color: "rgba(10,20,17,0.6)",
              lineHeight: 1.5,
            }}
          >
            Inclusions, exclusions, and notes flow through to client-facing
            sends with the brand greeting and signoff applied.
          </div>
        </div>

        {/* Greeting / signoff / signature mockup */}
        <div
          className="px-5 py-4"
          style={{
            borderTop: "1px solid rgba(10,20,17,0.08)",
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(10,20,17,0.5)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Client-facing send preview
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: bodyFontStack,
              fontSize: 12.5,
              color: "rgba(10,20,17,0.85)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
{greetingDemo} here&rsquo;s a clear breakdown of your safari pricing:{"\n\n"}
Total: USD {baseProposal.pricing?.[baseTier as "classic" | "premier" | "signature"]?.pricePerPerson || "—"}{"\n"}
≈ USD {baseProposal.pricing?.[baseTier as "classic" | "premier" | "signature"]?.pricePerPerson || "—"} per person{"\n\n"}
Happy to walk through it with you if helpful.{"\n\n"}
{signoffDemo}
          </pre>
          {form.whatsappSignatureFormat && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: bodyFontStack,
                fontSize: 11.5,
                color: "rgba(10,20,17,0.6)",
                lineHeight: 1.55,
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px dashed rgba(10,20,17,0.15)",
              }}
            >
              {expandTemplate(form.whatsappSignatureFormat, {
                operatorFirstName: sampleOperatorFirstName,
              })}
            </pre>
          )}
        </div>
      </div>
    </PreviewShell>
  );
}

// ─── Layout shell ────────────────────────────────────────────────────────

function PreviewShell({
  children,
  sourceLabel,
}: {
  children: React.ReactNode;
  sourceLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[10.5px] tracking-[0.18em] uppercase font-semibold text-black/55"
        >
          Live preview
        </div>
        {sourceLabel && (
          <div className="text-[10px] text-black/40">{sourceLabel}</div>
        )}
      </div>
      {children}
      <div className="text-[10.5px] text-black/35 mt-3 leading-snug">
        Unsaved changes apply to this preview only. Existing proposals are
        not modified — use Apply company brand on a proposal to push the
        latest brand to it.
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function pickColor(
  colors: BrandDNAForm["brandColors"],
  role: string,
  fallbackIndex: number,
): string | null {
  const named = colors.find((c) => c.role === role);
  if (named?.hex?.trim()) return named.hex.trim();
  const positional = colors[fallbackIndex];
  if (positional?.hex?.trim()) return positional.hex.trim();
  return null;
}

function fontStack(formFont: string, fallback: string | undefined): string {
  const primary = formFont.trim() || fallback?.trim() || "";
  if (!primary) {
    return "'Inter', -apple-system, Segoe UI, Roboto, sans-serif";
  }
  // Wrap multi-word font names in quotes — required by CSS.
  const safe = /\s/.test(primary) ? `'${primary}'` : primary;
  return `${safe}, -apple-system, Segoe UI, Roboto, sans-serif`;
}

function expandTemplate(
  template: string,
  values: { firstName?: string; operatorFirstName?: string },
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key === "firstName") return values.firstName ?? match;
    if (key === "operatorFirstName") return values.operatorFirstName ?? match;
    return match;
  });
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function sourceLabelFor(data: SourceResponse): string {
  switch (data.source) {
    case "master":
      return data.proposalRef?.title
        ? `Master template · ${data.proposalRef.title}`
        : "Master template";
    case "recent":
      return data.proposalRef?.title
        ? `Most recent · ${data.proposalRef.title}`
        : "Most recent proposal";
    case "fallback":
      return "Sample proposal (no proposals yet)";
  }
}
