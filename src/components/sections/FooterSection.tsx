"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
import { ContactCards } from "@/components/sections/personal-note/ContactCards";
import type { Section } from "@/lib/types";

// ─── FooterSection — operator brand strip + consultant identity ─────────
//
// Operator brief: "the footer to host the maker of the itinerary photo,
// email and whatsapp like in the personal greeting section." Footer
// now mirrors the Personal Note's bottom strip — consultant photo +
// name on the left, email / whatsapp ContactCards in the centre,
// company logo on the right — followed by a small row carrying the
// company name and website link.
//
// Background still resolves through tokens.sectionSurface so the
// section's bg picker keeps working.

export function FooterSection({ section }: { section: Section }) {
  const { proposal, updateOperator, updateSectionContent } = useProposalStore();
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

  const pickPhoto = () => {
    if (!isEditor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await uploadImage(file);
        updateOperator({ consultantPhoto: dataUrl });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Image upload failed");
      }
    };
    input.click();
  };

  return (
    <div
      className="py-8 md:py-10 px-6 md:px-12 border-t"
      style={{
        background: tokens.sectionSurface,
        borderColor: tokens.border,
        fontFamily: `'${theme.bodyFont}', sans-serif`,
      }}
    >
      {/* Identity strip — same shape as the Personal Note footer:
          consultant photo + name | email + whatsapp cards | logo. */}
      <div className="mx-auto max-w-[1200px]">
        <div className="ss-identity-strip">
          {/* Consultant — photo + name stacked */}
          <div className="flex flex-col items-center gap-2 shrink-0" style={{ width: 96 }}>
            <div
              className="overflow-hidden cursor-pointer w-full"
              style={{ height: 96, background: tokens.cardBg, borderRadius: 4 }}
              onClick={pickPhoto}
              onContextMenu={(e) => {
                if (!isEditor) return;
                e.preventDefault();
                pickPhoto();
              }}
              title={isEditor ? "Click / right-click to replace photo" : undefined}
            >
              {operator.consultantPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={operator.consultantPhoto}
                  alt={operator.consultantName}
                  className="w-full h-full object-cover"
                />
              ) : isEditor ? (
                <div
                  className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-[0.22em] text-center"
                  style={{ color: tokens.mutedText }}
                >
                  + Photo
                </div>
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ color: tokens.accent }}
                >
                  {operator.consultantName?.charAt(0) ?? "·"}
                </div>
              )}
            </div>
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-center leading-tight outline-none w-full"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateOperator({
                  consultantName: e.currentTarget.textContent?.trim() ?? operator.consultantName,
                })
              }
            >
              {operator.consultantName || (isEditor ? "Your name" : "")}
            </div>
          </div>

          {/* ContactCards — email + WhatsApp, with the same Style
              picker affordance as the Personal Note. */}
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

          {/* Company logo */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: 92, height: 92 }}
          >
            <EditableOperatorLogoTile
              bare
              isEditor={isEditor}
              logoUrl={effectiveLogoUrl}
              companyName={operator.companyName}
              logoHeight={68}
              onLogoChange={(url) => updateOperator({ logoUrl: url })}
            />
          </div>
        </div>

        {/* Brand line — company name + website. */}
        <div
          className="mt-6 pt-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderTop: `1px solid ${tokens.border}` }}
        >
          <div
            className="text-[12.5px] font-medium outline-none"
            style={{ color: tokens.headingText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updateOperator({ companyName: e.currentTarget.textContent?.trim() ?? operator.companyName })
            }
          >
            {operator.companyName || (isEditor ? "Your company" : "")}
          </div>
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
    </div>
  );
}
