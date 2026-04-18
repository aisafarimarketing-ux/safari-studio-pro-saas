"use client";

import { VOICE_AXES, type VoiceAxisKey } from "@/lib/brandDNA";
import { Field, TextArea } from "./Field";
import type { BrandDNAForm } from "./types";

// Voice & Tone carries the most weight in the completion score because the
// sliders + writing samples are the strongest knobs on AI output tone.

export function VoiceToneTab({
  form,
  update,
}: {
  form: BrandDNAForm;
  update: (patch: Partial<BrandDNAForm>) => void;
}) {
  return (
    <div className="space-y-8">
      <SectionIntro
        headline="How does your brand sound?"
        copy="Four sliders and two writing samples. Nothing here is mandatory — every signal we have makes proposals sound more like you."
      />

      <div className="space-y-6">
        {VOICE_AXES.map((axis) => (
          <SliderRow
            key={axis.key}
            axisKey={axis.key}
            left={axis.left}
            right={axis.right}
            value={form[axis.key]}
            onChange={(v) => update({ [axis.key]: v })}
          />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Field
          label="Writing sample 1"
          hint={`${form.writingSample1.length}/800`}
        >
          <TextArea
            value={form.writingSample1}
            onChange={(v) => update({ writingSample1: v })}
            placeholder="Paste a proposal paragraph, a cover email, or a destination write-up you're proud of."
            rows={6}
            maxLength={800}
          />
        </Field>
        <Field
          label="Writing sample 2"
          hint={`${form.writingSample2.length}/800`}
        >
          <TextArea
            value={form.writingSample2}
            onChange={(v) => update({ writingSample2: v })}
            placeholder="A second example in a different style — a follow-up email, a different itinerary type."
            rows={6}
            maxLength={800}
          />
        </Field>
      </div>
    </div>
  );
}

function SectionIntro({ headline, copy }: { headline: string; copy: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-black/85 tracking-tight">{headline}</h2>
      <p className="mt-1.5 text-[14px] text-black/55 max-w-2xl leading-relaxed">{copy}</p>
    </div>
  );
}

function SliderRow({
  axisKey,
  left,
  right,
  value,
  onChange,
}: {
  axisKey: VoiceAxisKey;
  left: string;
  right: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const displayValue = value ?? 50;
  const unset = value === null;

  return (
    <div className="rounded-xl border border-black/8 bg-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] uppercase tracking-wider font-semibold text-black/40">
            {axisKey.replace(/^voice/, "")}
          </span>
          {unset && (
            <span className="text-[10px] uppercase tracking-wider text-black/30 bg-black/5 px-1.5 py-0.5 rounded-full">
              not set
            </span>
          )}
        </div>
        {!unset && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-black/35 hover:text-black/60 transition"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium text-black/55 w-24 text-right tabular-nums">
          {left}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={displayValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`flex-1 ${unset ? "opacity-60" : ""}`}
          style={{
            accentColor: "#1b3a2d",
          }}
        />
        <span className="text-[13px] font-medium text-black/55 w-24">
          {right}
        </span>
      </div>
    </div>
  );
}
