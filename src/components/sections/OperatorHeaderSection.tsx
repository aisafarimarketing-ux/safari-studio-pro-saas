"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
import type { Section } from "@/lib/types";

export function OperatorHeaderSection({ section }: { section: Section }) {
  const { proposal, updateOperator, updateSectionContent } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant;
  const logoOverrideUrl = section.content.logoOverrideUrl as string | undefined;
  const effectiveLogoUrl = logoOverrideUrl || operator.logoUrl;
  const handleLogoChange = (url: string | undefined) =>
    updateSectionContent(section.id, { logoOverrideUrl: url });

  // Bound version of LogoBlock — closes over the section/operator
  // state above so the JSX call sites stay terse. Defined as a JSX
  // element factory rather than a component to avoid the React 19
  // "create components during render" rule (each variant just calls
  // renderLogoBlock(args)).
  const renderLogoBlock = (logoHeight = 40, className = "") => (
    <LogoBlock
      logoHeight={logoHeight}
      className={className}
      isEditor={isEditor}
      logoUrl={effectiveLogoUrl}
      companyName={operator.companyName}
      isOverridden={!!logoOverrideUrl}
      onLogoChange={handleLogoChange}
    />
  );

  // ── Centered-brand — logo + name centered ───────────────────────────────────
  if (variant === "centered-brand") {
    return (
      <div className="py-6 px-8 md:px-16 text-center" style={{ background: tokens.sectionSurface, borderBottom: `1px solid ${tokens.border}` }}>
        <div className="max-w-5xl mx-auto">
          {renderLogoBlock(48, "justify-center")}
          {!effectiveLogoUrl && (
            <div
              className="text-sm font-semibold tracking-wide mt-1 outline-none"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateOperator({ companyName: e.currentTarget.textContent?.trim() ?? operator.companyName })}
            >
              {operator.companyName}
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-2 text-[11px]" style={{ color: tokens.mutedText }}>
            {operator.email && <span>{operator.email}</span>}
            {operator.phone && <><span className="text-black/10">|</span><span>{operator.phone}</span></>}
            {operator.website && <><span className="text-black/10">|</span><span>{operator.website}</span></>}
          </div>
        </div>
      </div>
    );
  }

  // ── Split-logo-details — logo left, contact right ───────────────────────────
  if (variant === "split-logo-details") {
    return (
      <div className="py-5 px-8 md:px-16" style={{ background: tokens.sectionSurface, borderBottom: `1px solid ${tokens.border}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {renderLogoBlock(40)}
            <div>
              <div
                className="text-sm font-semibold outline-none"
                style={{ color: tokens.headingText }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => updateOperator({ companyName: e.currentTarget.textContent?.trim() ?? operator.companyName })}
              >
                {operator.companyName}
              </div>
              {operator.consultantName && (
                <div className="text-[11px] mt-0.5" style={{ color: tokens.mutedText }}>
                  {operator.consultantName}
                </div>
              )}
            </div>
          </div>
          <div className="text-right text-[11px] space-y-0.5" style={{ color: tokens.mutedText }}>
            {operator.email && <div className="outline-none" contentEditable={isEditor} suppressContentEditableWarning
              onBlur={(e) => updateOperator({ email: e.currentTarget.textContent?.trim() ?? operator.email })}>{operator.email}</div>}
            {operator.phone && <div>{operator.phone}</div>}
            {operator.website && <div>{operator.website}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ── Transparent-overlay — rendered over the next section (cover) ─────────────
  if (variant === "transparent-overlay") {
    return (
      <div className="relative z-20 py-4 px-8 md:px-16" style={{ background: "transparent" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {renderLogoBlock(32)}
            {!effectiveLogoUrl && (
              <span className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: tokens.mutedText }}>
                {operator.companyName}
              </span>
            )}
          </div>
          <div className="text-[10px] tracking-wide" style={{ color: tokens.mutedText }}>
            {operator.email}
          </div>
        </div>
      </div>
    );
  }

  // ── Minimal (default) — slim bar with logo and key details ──────────────────
  return (
    <div className="py-4 px-8 md:px-16" style={{ background: tokens.pageBg, borderBottom: `1px solid ${tokens.border}` }}>
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {renderLogoBlock(32)}
          {!effectiveLogoUrl && (
            <div
              className="text-[13px] font-semibold outline-none"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => updateOperator({ companyName: e.currentTarget.textContent?.trim() ?? operator.companyName })}
            >
              {operator.companyName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: tokens.mutedText }}>
          {operator.email && <span>{operator.email}</span>}
          {operator.phone && <><span className="text-black/10">|</span><span>{operator.phone}</span></>}
        </div>
      </div>
    </div>
  );
}

// Module-scope LogoBlock — kept outside OperatorHeaderSection so React
// 19's static-components rule doesn't flag it (re-creating components
// inside the render function resets state on every parent render).
function LogoBlock({
  logoHeight,
  className,
  isEditor,
  logoUrl,
  companyName,
  isOverridden,
  onLogoChange,
}: {
  logoHeight: number;
  className: string;
  isEditor: boolean;
  logoUrl: string | undefined;
  companyName: string;
  isOverridden: boolean;
  onLogoChange: (url: string | undefined) => void;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <EditableOperatorLogoTile
        bare
        isEditor={isEditor}
        logoUrl={logoUrl}
        companyName={companyName}
        logoHeight={logoHeight}
        isOverridden={isOverridden}
        onLogoChange={onLogoChange}
      />
    </div>
  );
}
