"use client";

import { DISPLAY_FONTS, BODY_FONTS } from "@/lib/theme";
import { useProposalStore } from "@/store/proposalStore";

export function FontSelector() {
  const { proposal, setDisplayFont, setBodyFont } = useProposalStore();
  const { displayFont, bodyFont } = proposal.theme;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-2">
          Display font
        </div>
        <div className="space-y-1">
          {DISPLAY_FONTS.map((f) => (
            <button
              key={f.name}
              onClick={() => setDisplayFont(f.name)}
              className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between ${
                displayFont === f.name
                  ? "bg-[#1b3a2d] text-white"
                  : "hover:bg-black/5 text-black/70"
              }`}
            >
              <span
                style={{ fontFamily: `'${f.name}', serif` }}
                className="text-base"
              >
                {f.label}
              </span>
              <span className="text-[10px] opacity-50 font-sans">Aa</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-widest text-black/40 mb-2">
          Body font
        </div>
        <div className="space-y-1">
          {BODY_FONTS.map((f) => (
            <button
              key={f.name}
              onClick={() => setBodyFont(f.name)}
              className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between ${
                bodyFont === f.name
                  ? "bg-[#1b3a2d] text-white"
                  : "hover:bg-black/5 text-black/70"
              }`}
            >
              <span
                style={{ fontFamily: `'${f.name}', sans-serif` }}
                className="text-sm"
              >
                {f.label}
              </span>
              <span className="text-[10px] opacity-50">Aa</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
