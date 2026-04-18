"use client";

import { Field, TextArea } from "./Field";
import type { BrandDNAForm } from "./types";

const EXAMPLES = [
  "Never recommend budget camps.",
  "Always offer a tier upgrade on the signature option.",
  "Use British English spellings.",
  "Lead with conservation credentials when relevant.",
  "Avoid jargon — write like you're talking to a first-time safari traveller.",
];

export function AIInstructionsTab({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  const appendExample = (ex: string) => {
    const current = form.aiInstructions.trim();
    const next = current ? `${current}\n- ${ex}` : `- ${ex}`;
    update({ aiInstructions: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-black/85 tracking-tight">
          AI guardrails
        </h2>
        <p className="mt-1.5 text-[14px] text-black/55 max-w-2xl leading-relaxed">
          Free-form rules the AI should always follow. Short bullets work best.
        </p>
      </div>

      <Field label="Instructions" hint={`${form.aiInstructions.length}/2000`}>
        <TextArea
          value={form.aiInstructions}
          onChange={(v) => update({ aiInstructions: v })}
          placeholder="- Never recommend budget camps&#10;- Always offer a tier upgrade&#10;- Keep tone warm and polished"
          rows={10}
          maxLength={2000}
        />
      </Field>

      <div>
        <div className="text-[12px] uppercase tracking-wider font-semibold text-black/40 mb-2">
          Ideas to drop in
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => appendExample(ex)}
              className="px-3 py-1.5 rounded-full text-[12px] text-black/60 border border-black/10 bg-white hover:bg-black/5 transition text-left max-w-[360px] truncate"
              title={ex}
            >
              + {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
