"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
import { ContactCards } from "@/components/sections/personal-note/ContactCards";
import type { Section } from "@/lib/types";

// FooterSection — last block of the proposal. Carries the operator
// identity (logo + consultant + company) and the contact details that
// used to live in the closing section's right column. Default variant
// is a tight 2-column layout: identity on the left, contact rows in a
// compact 2-up grid on the right. The minimal variant is a single row
// with name + email — used by legacy proposals that already have a
// dense closing block.

export function FooterSection({ section }: { section: Section }) {
  const { proposal, updateOperator, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const logoOverrideUrl = section.content.logoOverrideUrl as string | undefined;
  const effectiveLogoUrl = logoOverrideUrl || operator.logoUrl;

  if (section.layoutVariant === "minimal") {
    return (
      <div
        className="py-6 px-8 md:px-16 border-t"
        style={{ background: tokens.pageBg, borderColor: tokens.border }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between text-[12px]" style={{ color: tokens.mutedText }}>
          <span>{operator.companyName}</span>
          <span>{operator.email}</span>
        </div>
      </div>
    );
  }

  // Contact-cards — three pill cards in a horizontal row. Counterpart
  // to the editorial-letter-image PersonalNote variant: clean, light,
  // hover-lift, no clutter. Now shares the ContactCards component with
  // the Personal Note's bottom strip so the editor inputs, style picker
  // (chip / icon / card-bg colours), clickable hrefs in preview, and
  // PDF plain-text fallback all behave consistently between the two
  // surfaces.
  if (section.layoutVariant === "contact-cards") {
    return (
      <div
        className="py-10 md:py-12 px-6 md:px-12"
        style={{
          background: tokens.pageBg,
          fontFamily: `'${theme.bodyFont}', sans-serif`,
        }}
      >
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
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
    );
  }

  const contactRows: Array<{
    label: string;
    value: string;
    placeholder: string;
    onChange: (v: string) => void;
  }> = [];
  if (operator.email || isEditor)
    contactRows.push({
      label: "Email",
      value: operator.email,
      placeholder: "email@…",
      onChange: (v) => updateOperator({ email: v }),
    });
  if (operator.phone || isEditor)
    contactRows.push({
      label: "Phone",
      value: operator.phone,
      placeholder: "+1 555 …",
      onChange: (v) => updateOperator({ phone: v }),
    });
  if (operator.whatsapp || isEditor)
    contactRows.push({
      label: "WhatsApp",
      value: operator.whatsapp ?? "",
      placeholder: "+1 555 …",
      onChange: (v) => updateOperator({ whatsapp: v }),
    });
  if (operator.website || isEditor)
    contactRows.push({
      label: "Website",
      value: operator.website ?? "",
      placeholder: "example.com",
      onChange: (v) => updateOperator({ website: v }),
    });
  if (operator.address || isEditor)
    contactRows.push({
      label: "Address",
      value: operator.address ?? "",
      placeholder: "Street, city",
      onChange: (v) => updateOperator({ address: v }),
    });
  if (operator.country || isEditor)
    contactRows.push({
      label: "Country",
      value: operator.country ?? "",
      placeholder: "Country",
      onChange: (v) => updateOperator({ country: v }),
    });

  return (
    <div
      className="py-10 md:py-12 px-8 md:px-16 border-t"
      style={{
        background: tokens.pageBg,
        borderColor: tokens.border,
        fontFamily: `'${theme.bodyFont}', sans-serif`,
      }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 md:gap-12 items-start">
        {/* ── Identity (left) — logo + company + consultant inline ── */}
        <div className="flex items-start gap-4">
          {(effectiveLogoUrl || isEditor) && (
            <div className="shrink-0">
              <EditableOperatorLogoTile
                bare
                isEditor={isEditor}
                logoUrl={effectiveLogoUrl}
                companyName={operator.companyName}
                logoHeight={48}
                isOverridden={!!logoOverrideUrl}
                onLogoChange={(url) =>
                  updateSectionContent(section.id, { logoOverrideUrl: url })
                }
              />
            </div>
          )}

          <div className="min-w-0">
            <div
              className="text-[15px] font-semibold leading-tight"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
              }}
            >
              {operator.companyName}
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              {operator.consultantPhoto ? (
                <div
                  className="shrink-0 overflow-hidden rounded-full"
                  style={{ width: 36, height: 36, background: tokens.cardBg }}
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
                  className="shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold"
                  style={{
                    width: 36,
                    height: 36,
                    background: `${tokens.accent}1c`,
                    color: tokens.accent,
                  }}
                >
                  {operator.consultantName?.charAt(0) ?? "·"}
                </div>
              )}
              <div className="min-w-0">
                <div
                  className="text-[12.5px] font-semibold leading-tight"
                  style={{ color: tokens.headingText }}
                >
                  {operator.consultantName || "Your consultant"}
                </div>
                {operator.consultantRole && (
                  <div className="text-[11px] mt-0.5" style={{ color: tokens.mutedText }}>
                    {operator.consultantRole}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Contact rows (right) — 2-column compact grid ── */}
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-3"
            style={{ color: tokens.mutedText }}
          >
            Get in touch
          </div>
          {contactRows.length > 0 ? (
            <dl
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[12.5px]"
              style={{ color: tokens.bodyText }}
            >
              {contactRows.map((row) => (
                <ContactRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  placeholder={row.placeholder}
                  isEditor={isEditor}
                  onChange={row.onChange}
                  tokens={tokens}
                />
              ))}
            </dl>
          ) : (
            <div className="text-[11.5px]" style={{ color: tokens.mutedText }}>
              Add contact details in Trip → Operator.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  label,
  value,
  isEditor,
  onChange,
  placeholder,
  tokens,
}: {
  label: string;
  value: string;
  isEditor: boolean;
  onChange: (v: string) => void;
  placeholder: string;
  tokens: ReturnType<typeof resolveTokens>;
}) {
  return (
    <div className="grid grid-cols-[68px_1fr] gap-2 items-baseline">
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: tokens.mutedText }}
      >
        {label}
      </span>
      <span
        className="outline-none truncate"
        contentEditable={isEditor}
        suppressContentEditableWarning
        onBlur={(e) => onChange(e.currentTarget.textContent?.trim() ?? value)}
      >
        {value || (isEditor ? placeholder : "")}
      </span>
    </div>
  );
}

