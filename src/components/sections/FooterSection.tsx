"use client";

import { useProposalStore } from "@/store/proposalStore";
import type { Section } from "@/lib/types";

export function FooterSection({ section }: { section: Section }) {
  const { proposal } = useProposalStore();
  const { operator, theme } = proposal;
  const tokens = theme.tokens;

  return (
    <div
      className="py-10 px-8 md:px-16 border-t"
      style={{ background: tokens.pageBg, borderColor: tokens.border }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3">
          {operator.logoUrl ? (
            <img src={operator.logoUrl} alt={operator.companyName} className="h-6 object-contain" />
          ) : (
            <span className="font-semibold" style={{ color: tokens.headingText }}>
              {operator.companyName}
            </span>
          )}
        </div>

        <div className="text-center space-y-0.5" style={{ color: tokens.mutedText }}>
          {operator.consultantName && (
            <div className="font-medium" style={{ color: tokens.bodyText }}>
              {operator.consultantName}
            </div>
          )}
          {operator.email && <div>{operator.email}</div>}
          {operator.phone && <div>{operator.phone}</div>}
        </div>

        <div className="text-right" style={{ color: tokens.mutedText }}>
          {operator.website && (
            <div className="font-medium" style={{ color: tokens.bodyText }}>
              {operator.website}
            </div>
          )}
          {operator.address && <div>{operator.address}</div>}
        </div>
      </div>
    </div>
  );
}
