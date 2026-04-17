"use client";

import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { fileToOptimizedDataUrl } from "@/lib/fileToDataUrl";
import type { Section } from "@/lib/types";

export function OperatorHeaderSection({ section }: { section: Section }) {
  const { proposal, updateOperator } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const variant = section.layoutVariant;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToOptimizedDataUrl(file, { maxDimension: 800 });
      updateOperator({ logoUrl: dataUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Logo upload failed");
    }
  };

  const LogoBlock = ({ maxH = "h-10", className = "" }: { maxH?: string; className?: string }) => (
    <div className={`flex items-center gap-3 ${className}`}>
      {operator.logoUrl ? (
        <div className="relative group">
          <img src={operator.logoUrl} alt={operator.companyName} className={`${maxH} object-contain`} />
          {isEditor && (
            <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer bg-black/30 rounded transition">
              <input type="file" accept="image/*,.svg" className="hidden" onChange={handleLogoUpload} />
              <span className="text-white text-[9px] font-medium">Replace</span>
            </label>
          )}
        </div>
      ) : isEditor ? (
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer hover:bg-black/3 transition" style={{ borderColor: tokens.border }}>
          <input type="file" accept="image/*,.svg" className="hidden" onChange={handleLogoUpload} />
          <span className="text-[11px]" style={{ color: tokens.mutedText }}>+ Logo</span>
        </label>
      ) : null}
    </div>
  );

  // ── Centered-brand — logo + name centered ───────────────────────────────────
  if (variant === "centered-brand") {
    return (
      <div className="py-6 px-8 md:px-16 text-center" style={{ background: tokens.sectionSurface, borderBottom: `1px solid ${tokens.border}` }}>
        <div className="max-w-5xl mx-auto">
          <LogoBlock maxH="h-12" className="justify-center" />
          {!operator.logoUrl && (
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
            <LogoBlock maxH="h-10" />
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
            <LogoBlock maxH="h-8" />
            {!operator.logoUrl && (
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
          <LogoBlock maxH="h-8" />
          {!operator.logoUrl && (
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
