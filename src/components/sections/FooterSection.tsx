"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
import type { Section } from "@/lib/types";

// ─── FooterSection — quiet operator brand strip ─────────────────────────
//
// Operator brief: "minimize this footer section, it needs not to scream
// for attention with the closing page that is for selling."
//
// This used to be a triple-decker — logo/company on the left, full
// consultant identity (photo + role + signature) on the right, plus
// a row of Email + WhatsApp pills below (rendered TWICE in editor
// mode because ContactCards shows both inputs and display cards).
// All of that competed with the Closing's Secure-Your-Trip CTA right
// above it.
//
// The new footer is a single quiet line: logo + company name +
// website link. Consultant identity is already in the Personal Note
// + Closing; Email / WhatsApp pills live in the Closing's secondary
// actions row. The footer is now operator brand identity only —
// nothing more.
//
// Background still resolves through tokens.sectionSurface so the
// section's bg picker keeps working.

export function FooterSection({ section }: { section: Section }) {
  const { proposal, updateOperator } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const effectiveLogoUrl = operator.logoUrl;

  const websiteHref = (() => {
    const w = (operator.website ?? "").trim();
    if (!w) return "";
    if (/^https?:\/\//i.test(w)) return w;
    return `https://${w}`;
  })();

  return (
    <div
      className="py-5 md:py-6 px-6 md:px-12 border-t"
      style={{
        background: tokens.sectionSurface,
        borderColor: tokens.border,
        fontFamily: `'${theme.bodyFont}', sans-serif`,
      }}
    >
      <div className="mx-auto max-w-[1100px] flex items-center justify-between gap-4 flex-wrap">
        {/* Left — logo + company */}
        <div className="flex items-center gap-3 min-w-0">
          {(effectiveLogoUrl || isEditor) && (
            <div className="shrink-0">
              <EditableOperatorLogoTile
                bare
                isEditor={isEditor}
                logoUrl={effectiveLogoUrl}
                companyName={operator.companyName}
                logoHeight={28}
                onLogoChange={(url) => updateOperator({ logoUrl: url })}
              />
            </div>
          )}
          <div
            className="text-[12.5px] font-medium truncate"
            style={{ color: tokens.headingText }}
          >
            {operator.companyName || (isEditor ? "Your company" : "")}
          </div>
        </div>

        {/* Right — website link only. Email / WhatsApp / consultant
            identity all live above (Personal Note + Closing); the
            footer doesn't repeat them. */}
        {(websiteHref || isEditor) && (
          <div className="text-[12px]" style={{ color: tokens.mutedText }}>
            {websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline transition outline-none"
                style={{ color: tokens.accent }}
              >
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    updateOperator({ website: e.currentTarget.textContent?.trim() || "" })
                  }
                >
                  {operator.website}
                </span>
              </a>
            ) : (
              <span
                className="outline-none"
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateOperator({ website: e.currentTarget.textContent?.trim() || "" })
                }
              >
                yourcompany.com
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
