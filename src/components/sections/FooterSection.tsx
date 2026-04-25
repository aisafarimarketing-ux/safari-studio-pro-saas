"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import type { Section } from "@/lib/types";

// FooterSection — last block of the proposal. Carries the operator
// branding + the consultant identity card and the contact block that
// previously lived in the right-hand column of the closing-farewell
// variant. Splitting the two means the closing can be a single, focused
// "Confirm Booking" moment, while the contact details stay readable.

export function FooterSection({ section }: { section: Section }) {
  const { proposal, updateOperator } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // Minimal variant — single row, low visual weight. Used when the closing
  // already has a strong contact block (legacy proposals that hand-edited
  // out the migration).
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

  // Default variant — three-column branded footer.
  return (
    <div
      className="py-12 px-8 md:px-16 border-t"
      style={{
        background: tokens.pageBg,
        borderColor: tokens.border,
        fontFamily: `'${theme.bodyFont}', sans-serif`,
      }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Left — brand + tagline */}
        <div className="space-y-4">
          {operator.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={operator.logoUrl}
              alt={operator.companyName}
              className="h-12 object-contain"
            />
          ) : (
            <div
              className="text-[15px] font-bold"
              style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
            >
              {operator.companyName}
            </div>
          )}
          {operator.companyName && operator.logoUrl && (
            <div className="text-[12px]" style={{ color: tokens.mutedText }}>
              {operator.companyName}
            </div>
          )}
        </div>

        {/* Centre — consultant identity */}
        <div className="space-y-2">
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-2"
            style={{ color: tokens.mutedText }}
          >
            Your consultant
          </div>
          <div className="flex items-start gap-3">
            {operator.consultantPhoto ? (
              <div
                className="shrink-0 overflow-hidden rounded-full"
                style={{ width: 44, height: 44, background: tokens.cardBg }}
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
                className="shrink-0 rounded-full flex items-center justify-center text-[15px] font-bold"
                style={{
                  width: 44,
                  height: 44,
                  background: `${tokens.accent}1c`,
                  color: tokens.accent,
                }}
              >
                {operator.consultantName?.charAt(0) ?? "·"}
              </div>
            )}
            <div className="min-w-0">
              <div
                className="text-[14px] font-semibold leading-tight"
                style={{ color: tokens.headingText, fontFamily: `'${theme.displayFont}', serif` }}
              >
                {operator.consultantName || "Your consultant"}
              </div>
              {operator.consultantRole && (
                <div className="text-[11.5px] mt-0.5" style={{ color: tokens.mutedText }}>
                  {operator.consultantRole}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — contact rows */}
        <div className="space-y-1.5 text-[13px]" style={{ color: tokens.bodyText }}>
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-2"
            style={{ color: tokens.mutedText }}
          >
            Get in touch
          </div>
          {(operator.email || isEditor) && (
            <ContactRow
              label="Email"
              value={operator.email}
              isEditor={isEditor}
              onChange={(v) => updateOperator({ email: v })}
              placeholder="email@…"
              tokens={tokens}
            />
          )}
          {(operator.phone || isEditor) && (
            <ContactRow
              label="Phone"
              value={operator.phone}
              isEditor={isEditor}
              onChange={(v) => updateOperator({ phone: v })}
              placeholder="+1 555 …"
              tokens={tokens}
            />
          )}
          {(operator.whatsapp || isEditor) && (
            <ContactRow
              label="WhatsApp"
              value={operator.whatsapp ?? ""}
              isEditor={isEditor}
              onChange={(v) => updateOperator({ whatsapp: v })}
              placeholder="+1 555 …"
              tokens={tokens}
            />
          )}
          {(operator.website || isEditor) && (
            <ContactRow
              label="Website"
              value={operator.website ?? ""}
              isEditor={isEditor}
              onChange={(v) => updateOperator({ website: v })}
              placeholder="example.com"
              tokens={tokens}
            />
          )}
          {(operator.address || isEditor) && (
            <ContactRow
              label="Address"
              value={operator.address ?? ""}
              isEditor={isEditor}
              onChange={(v) => updateOperator({ address: v })}
              placeholder="Street, city"
              tokens={tokens}
            />
          )}
          {(operator.country || isEditor) && (
            <ContactRow
              label="Country"
              value={operator.country ?? ""}
              isEditor={isEditor}
              onChange={(v) => updateOperator({ country: v })}
              placeholder="Country"
              tokens={tokens}
            />
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
    <div className="grid grid-cols-[80px_1fr] gap-3 items-baseline">
      <span className="text-[11px] font-semibold" style={{ color: tokens.headingText }}>
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
