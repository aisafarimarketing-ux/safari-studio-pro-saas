"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
import { ContactCards } from "@/components/sections/personal-note/ContactCards";
import type { Section } from "@/lib/types";

// ─── FooterSection — unified single layout ──────────────────────────────
//
// One layout, no variant switcher. Per operator request, the footer
// always carries the consultant identity from the Personal Note
// (photo + name + role + signature) plus contact pills (Email +
// WhatsApp) and a website link. Background colour is configurable
// via SectionChrome — the outer wrapper resolves through
// resolveTokens(theme, section.styleOverrides) so the bg picker on
// the section handle writes to styleOverrides.sectionSurface and
// re-skins the whole block.
//
// Legacy proposals saved with layoutVariant "contact-cards" /
// "minimal" / "default" all render the same unified layout — the
// saved variant string is ignored. Operators who liked the old
// dense contact-rows layout can re-add a Custom Text section if they
// want that level of detail.
//
// Visibility rules — DO NOT REGRESS:
//   1. Background colour MUST come from tokens.sectionSurface (resolved
//      through section.styleOverrides). Never hardcode a colour or use
//      tokens.pageBg — that breaks the bg picker.
//   2. Email / WhatsApp render through the shared ContactCards
//      component so the editor inputs, hover style picker, click-to-
//      mail / wa.me hrefs, and print fallback stay consistent with
//      the Personal Note's bottom strip.
//   3. Website renders as a clickable link in preview / share view.
//      In editor mode it's contentEditable for direct typing.

export function FooterSection({ section }: { section: Section }) {
  const { proposal, updateOperator, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const logoOverrideUrl = section.content.logoOverrideUrl as string | undefined;
  const effectiveLogoUrl = logoOverrideUrl || operator.logoUrl;

  const websiteHref = (() => {
    const w = (operator.website ?? "").trim();
    if (!w) return "";
    if (/^https?:\/\//i.test(w)) return w;
    return `https://${w}`;
  })();

  return (
    <div
      className="py-12 md:py-14 px-6 md:px-12 border-t"
      style={{
        background: tokens.sectionSurface,
        borderColor: tokens.border,
        fontFamily: `'${theme.bodyFont}', sans-serif`,
      }}
    >
      <div className="mx-auto max-w-[1100px] space-y-8">
        {/* ── Identity row — logo / company on the left, consultant on the right ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Logo + company name */}
          <div className="flex items-start gap-4">
            {(effectiveLogoUrl || isEditor) && (
              <div className="shrink-0">
                <EditableOperatorLogoTile
                  bare
                  isEditor={isEditor}
                  logoUrl={effectiveLogoUrl}
                  companyName={operator.companyName}
                  logoHeight={52}
                  isOverridden={!!logoOverrideUrl}
                  onLogoChange={(url) =>
                    updateSectionContent(section.id, { logoOverrideUrl: url })
                  }
                />
              </div>
            )}
            <div className="min-w-0">
              <div
                className="text-[16px] font-semibold leading-tight"
                style={{
                  color: tokens.headingText,
                  fontFamily: `'${theme.displayFont}', serif`,
                }}
              >
                {operator.companyName || (isEditor ? "Your company" : "")}
              </div>
              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline transition"
                  style={{ color: tokens.accent }}
                >
                  <span aria-hidden>→</span>
                  <span
                    className="outline-none"
                    contentEditable={isEditor}
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      updateOperator({ website: e.currentTarget.textContent?.trim() || "" })
                    }
                  >
                    {operator.website}
                  </span>
                </a>
              )}
              {!websiteHref && isEditor && (
                <div
                  className="mt-1.5 text-[12.5px] outline-none"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    updateOperator({ website: e.currentTarget.textContent?.trim() || "" })
                  }
                  style={{ color: tokens.mutedText }}
                >
                  yourcompany.com
                </div>
              )}
            </div>
          </div>

          {/* Consultant identity — same fields as the Personal Note: photo,
              name, role title, optional signature image. Photo / role
              come from operator profile (set via the onboarding flow);
              signature is the uploaded handwriting from the consultant
              identity panel. */}
          <div className="flex items-start gap-3.5">
            {operator.consultantPhoto ? (
              <div
                className="shrink-0 overflow-hidden rounded-full"
                style={{ width: 56, height: 56, background: tokens.cardBg }}
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
                className="shrink-0 rounded-full flex items-center justify-center text-[18px] font-bold"
                style={{
                  width: 56,
                  height: 56,
                  background: `${tokens.accent}1c`,
                  color: tokens.accent,
                }}
              >
                {operator.consultantName?.charAt(0) ?? "·"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="text-[15px] font-semibold leading-tight"
                style={{ color: tokens.headingText }}
              >
                {operator.consultantName || (isEditor ? "Your name" : "")}
              </div>
              {(operator.consultantRole || isEditor) && (
                <div className="text-[12px] mt-0.5" style={{ color: tokens.mutedText }}>
                  {operator.consultantRole || (isEditor ? "Your role" : "")}
                </div>
              )}
              {operator.signatureUrl && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={operator.signatureUrl}
                    alt="Signature"
                    className="object-contain"
                    style={{ height: 36, maxWidth: 180 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Contact pills — Email + WhatsApp via shared component ── */}
        <div>
          <ContactCards
            isEditor={isEditor}
            values={{
              phone: operator.phone,
              email: operator.email,
              whatsapp: operator.whatsapp,
            }}
            style={{
              iconBg: section.content.contactIconBg as string | undefined,
              iconColor: section.content.contactIconColor as string | undefined,
              cardBg: section.content.contactCardBg as string | undefined,
            }}
            onValueChange={(next) =>
              updateOperator({
                phone: next.phone ?? "",
                email: next.email ?? "",
                whatsapp: next.whatsapp ?? "",
              })
            }
            onStyleChange={(next) =>
              updateSectionContent(section.id, {
                contactIconBg: next.iconBg,
                contactIconColor: next.iconColor,
                contactCardBg: next.cardBg,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
