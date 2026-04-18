// Brand DNA → system prompt fragment.
//
// Pure function. Takes a BrandDNAProfile (possibly null / partial) and
// produces a text block to append to the system prompt. The shape is
// designed to be:
//
//   1. Optional — empty profile → empty string (caller falls back to defaults).
//   2. Grounded — every claim about the brand comes from the profile data;
//      we explicitly tell the model not to invent details that aren't here.
//   3. Cache-friendly — the output is deterministic (no timestamps / IDs),
//      so the prefix bytes are stable per org and prompt-caching works.
//   4. Resilient — any subset of fields can be missing; sections turn off
//      independently. Generation never breaks because Voice or Samples is
//      empty.

import type { BrandDNAProfile } from "@prisma/client";
import {
  STYLE_BIAS,
  TIER_BIAS,
  type VoiceAxisKey,
} from "@/lib/brandDNA";

// Translate a 0-100 slider value into a directive sentence Claude can act on.
// Five buckets keeps the language varied without inventing precision the
// signal doesn't have.
type AxisCopy = {
  far: { left: string; right: string };  // 0-15 / 85-100
  lean: { left: string; right: string }; // 16-40 / 60-84
  balanced: string;                      // 41-59
};

const AXIS_COPY: Record<VoiceAxisKey, AxisCopy> = {
  voiceFormality: {
    far: {
      left: "Write strictly formally. No contractions. Address the reader respectfully and at a measured distance.",
      right: "Write conversationally — like a trusted friend with deep knowledge. Use contractions naturally.",
    },
    lean: {
      left: "Lean formal. Polished, professional, sparing with contractions.",
      right: "Lean conversational. Warm and personable, but still polished.",
    },
    balanced: "Hold a polished-conversational middle: friendly but never casual, precise but never stiff.",
  },
  voiceLuxury: {
    far: {
      left: "Lead with refinement, craft, exclusivity, and quiet luxury. Avoid words like \"adventure\" or \"rugged\".",
      right: "Lead with adventure, exhilaration, and the wild. Energy and grit over polish.",
    },
    lean: {
      left: "Lean luxury. Refinement and ease come first; adventure is present but never the headline.",
      right: "Lean adventurous. Foreground the wildness and the experience; luxury supports rather than leads.",
    },
    balanced: "Hold luxury and adventure in equal measure — the comfort of the camp and the wildness of the country.",
  },
  voiceDensity: {
    far: {
      left: "Be ruthlessly concise. Short sentences. No second adjective when one will do.",
      right: "Be detailed and immersive. Use sensory specifics, layered description, longer sentence rhythm.",
    },
    lean: {
      left: "Lean concise. Tight sentences; cut filler.",
      right: "Lean detailed. Take the time to set scene and texture.",
    },
    balanced: "Match length to the moment — concise for logistics, more expansive for atmosphere.",
  },
  voiceStorytelling: {
    far: {
      left: "Lead with story. Open scenes; let practical facts emerge through the narrative.",
      right: "Lead with information. State the practical \"what / where / when / why now\" first; story supports.",
    },
    lean: {
      left: "Lean storytelling. Frame moments cinematically; weave logistics in.",
      right: "Lean informational. Get to the point; use story to colour rather than lead.",
    },
    balanced: "Open with one short scene-setting beat, then deliver the practical information.",
  },
};

function axisDirective(key: VoiceAxisKey, value: number): string {
  const copy = AXIS_COPY[key];
  if (value <= 15) return copy.far.left;
  if (value <= 40) return copy.lean.left;
  if (value < 60) return copy.balanced;
  if (value < 85) return copy.lean.right;
  return copy.far.right;
}

// ─── Section builders ──────────────────────────────────────────────────────

function buildIdentitySection(p: BrandDNAProfile): string | null {
  const lines: string[] = [];
  if (p.brandName?.trim()) lines.push(`Brand: ${p.brandName.trim()}`);
  if (p.tagline?.trim()) lines.push(`Tagline: ${p.tagline.trim()}`);
  if (p.shortDescription?.trim()) lines.push(`About: ${p.shortDescription.trim()}`);
  if (lines.length === 0) return null;
  return `Brand identity:\n${lines.join("\n")}`;
}

function buildVoiceSection(p: BrandDNAProfile): string | null {
  const directives: string[] = [];
  if (p.voiceFormality !== null) directives.push(`- ${axisDirective("voiceFormality", p.voiceFormality)}`);
  if (p.voiceLuxury !== null) directives.push(`- ${axisDirective("voiceLuxury", p.voiceLuxury)}`);
  if (p.voiceDensity !== null) directives.push(`- ${axisDirective("voiceDensity", p.voiceDensity)}`);
  if (p.voiceStorytelling !== null) directives.push(`- ${axisDirective("voiceStorytelling", p.voiceStorytelling)}`);
  if (directives.length === 0) return null;
  return `Voice & tone (apply consistently — these override generic style defaults):\n${directives.join("\n")}`;
}

function buildSamplesSection(p: BrandDNAProfile): string | null {
  const samples = [p.writingSample1, p.writingSample2]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  if (samples.length === 0) return null;

  const blocks = samples.map((s, i) => `Sample ${i + 1}:\n"""\n${s}\n"""`).join("\n\n");
  return [
    "Writing samples — match this voice. Mirror sentence rhythm, vocabulary register, and the way moments are framed. These are the ground truth for how this brand writes; weight them above the slider directives when they conflict.",
    blocks,
  ].join("\n\n");
}

function buildSelectionBiasSection(p: BrandDNAProfile): string | null {
  const lines: string[] = [];
  if (p.tierBias) {
    const label = TIER_BIAS.find((t) => t.id === p.tierBias)?.label ?? p.tierBias;
    lines.push(`- Tier bias: ${label}.`);
  }
  if (p.styleBias && p.styleBias.length > 0) {
    const labels = p.styleBias
      .map((id) => STYLE_BIAS.find((s) => s.id === id)?.label ?? id)
      .join(", ");
    lines.push(`- Typical trip styles: ${labels}.`);
  }
  if (lines.length === 0) return null;
  return `Selection bias (use only as soft preference when picking words like \"the right camp\" or describing ideal guests — never claim or invent specific properties unless the user provides them):\n${lines.join("\n")}`;
}

function buildInstructionsSection(p: BrandDNAProfile): string | null {
  const text = p.aiInstructions?.trim();
  if (!text) return null;
  return `Brand-specific rules (apply to every response, no exceptions):\n${text}`;
}

// ─── Public ─────────────────────────────────────────────────────────────────

export function buildBrandDNAPromptSection(
  profile: BrandDNAProfile | null,
): string {
  if (!profile) return "";

  const sections = [
    buildIdentitySection(profile),
    buildVoiceSection(profile),
    buildSamplesSection(profile),
    buildSelectionBiasSection(profile),
    buildInstructionsSection(profile),
  ].filter((s): s is string => s !== null);

  if (sections.length === 0) return "";

  return [
    "",
    "─── Brand DNA ───",
    "Apply the brand context below to every response. Treat it as ground truth about how this brand sounds and what it cares about.",
    "If a signal is missing, fall back to the default style rules above — never invent brand details (founder names, locations, accolades, history) that are not stated here.",
    "",
    sections.join("\n\n"),
    "─── End Brand DNA ───",
  ].join("\n");
}

// True iff the profile contributes anything to the system prompt — used by
// the API route to decide whether prompt caching is worth a breakpoint.
export function brandDNAHasContent(profile: BrandDNAProfile | null): boolean {
  if (!profile) return false;
  return buildBrandDNAPromptSection(profile).length > 0;
}
