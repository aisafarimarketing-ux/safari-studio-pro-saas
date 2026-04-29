"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
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
  // hover-lift, no clutter.
  if (section.layoutVariant === "contact-cards") {
    const cards: Array<{ label: string; value: string; href: string; icon: React.ReactNode }> = [];
    if (operator.phone) {
      cards.push({
        label: "Phone",
        value: operator.phone,
        href: `tel:${operator.phone.replace(/\s+/g, "")}`,
        icon: <PhoneIcon />,
      });
    }
    if (operator.email) {
      cards.push({
        label: "Email",
        value: operator.email,
        href: `mailto:${operator.email}`,
        icon: <EmailIcon />,
      });
    }
    if (operator.whatsapp) {
      cards.push({
        label: "WhatsApp",
        value: "Chat on WhatsApp",
        href: `https://wa.me/${operator.whatsapp.replace(/[^0-9]/g, "")}`,
        icon: <WhatsAppIcon />,
      });
    }
    // Editor-only: render placeholder cards when nothing's set so the
    // operator can see the layout and click into settings.
    if (cards.length === 0 && isEditor) {
      cards.push(
        { label: "Phone",    value: "Add phone in settings",    href: "#", icon: <PhoneIcon /> },
        { label: "Email",    value: "Add email in settings",    href: "#", icon: <EmailIcon /> },
        { label: "WhatsApp", value: "Add WhatsApp in settings", href: "#", icon: <WhatsAppIcon /> },
      );
    }
    if (cards.length === 0) return null;

    return (
      <div
        className="py-10 md:py-12 px-6 md:px-12"
        style={{
          background: tokens.pageBg,
          fontFamily: `'${theme.bodyFont}', sans-serif`,
        }}
      >
        <div className="mx-auto" style={{ maxWidth: 1140 }}>
          <div
            className="grid gap-3 md:gap-4"
            style={{
              gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))`,
            }}
          >
            {cards.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-3 transition-transform"
                style={{
                  background: "#FFFFFF",
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 14,
                  padding: "16px 18px",
                  textDecoration: "none",
                  boxShadow: "0 1px 0 rgba(13,38,32,0.02)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 12px 28px -12px rgba(13,38,32,0.18)";
                  e.currentTarget.style.borderColor = "rgba(13,38,32,0.16)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 0 rgba(13,38,32,0.02)";
                  e.currentTarget.style.borderColor = tokens.border;
                }}
              >
                <span
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "rgba(27,58,45,0.07)",
                    color: "#1b3a2d",
                  }}
                  aria-hidden
                >
                  {c.icon}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[12.5px] font-semibold"
                    style={{ color: tokens.headingText, lineHeight: 1.2 }}
                  >
                    {c.label}
                  </div>
                  <div
                    className="text-[12.5px] mt-0.5 truncate"
                    style={{ color: tokens.mutedText, lineHeight: 1.3 }}
                  >
                    {c.value}
                  </div>
                </div>
              </a>
            ))}
          </div>
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

// ─── Icons used by the contact-cards variant ─────────────────────────────

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 5 a1.5 1.5 0 0 1 1.5-1.5h1.6a1 1 0 0 1 1 .8l.5 2.5a1 1 0 0 1-.3 1l-1.3 1.3a9 9 0 0 0 4.6 4.6l1.3-1.3a1 1 0 0 1 1-.3l2.5.5a1 1 0 0 1 .8 1V15a1.5 1.5 0 0 1-1.5 1.5C8 16.5 1.5 10 1.5 4.5" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="14" height="10" rx="1.6" />
      <path d="M2.5 5 L9 10 L15.5 5" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4L3 21" />
      <path d="M9 10a3 3 0 0 0 3 3l1.5-1.5a1 1 0 0 1 1 0l2 1.3a1 1 0 0 1 .3 1.2l-.3.6a3 3 0 0 1-3 2" />
    </svg>
  );
}
