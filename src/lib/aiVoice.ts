// ─── Luxury voice discipline — central prompt fragment ───────────────────
//
// Canonical BAN list and operator-voice rules used by every Safari Studio
// AI proposal-writing endpoint. Per /docs/SAFARI_STUDIO_GUIDELINES.md, all
// AI prompts that touch narrative content must include this fragment so
// the discipline never drifts between surfaces (autopilot, rewrite,
// tone-shift, fill-blanks, property-content, rebuild-budget, etc.).
//
// Usage — interpolate into the system prompt at the appropriate slot:
//
//   const SYSTEM = `${preamble}
//
//   ${LUXURY_VOICE_DISCIPLINE}
//
//   ${task-specific rules}`;
//
// Do NOT extend per-endpoint with "ADDITIONAL bans" — if a new banned
// word matters everywhere, add it here. If it matters in one endpoint
// only, that's a sign the endpoint is doing something off-brand.
//
// Out of scope for this fragment: short follow-up messages
// (auto-draft, follow-up) which have their own message-style rules,
// data-extraction endpoints (import-proposal, summarize-reservation),
// and agentic endpoints (decide, execute) that don't author narrative.

// The canonical BAN list. This is the floor; never relax it per endpoint.
// If a new banned word matters everywhere, add it here. Endpoints with
// their own elaborated VOICE bullets (e.g. /api/ai/generate) compose
// LUXURY_VOICE_BANS into their own structure; everyone else uses
// LUXURY_VOICE_DISCIPLINE which is BAN + the default short VOICE line.
export const LUXURY_VOICE_BANS = `BAN — never use these words, or any close variant:
- Adjective clichés: stunning, breathtaking, amazing, incredible, unforgettable, magical, magnificent, awe-inspiring, world-class, luxurious, luxe, iconic, ultimate, lush, vibrant, verdant, pristine, picturesque, idyllic.
- Marketing verbs: discover, immerse yourself, escape (to), unwind, embark on, indulge, "experience the magic", "step into".
- Brochure phrases: nestled in, tucked away, hidden gem, dotted with, paradise, rolling savannahs, rich biodiversity, "sights and sounds", "the perfect blend of", "a true testament to".
- AI tells: "Whether you're…", "From X to Y, …", "ensures", openings that introduce the destination as the hero.
- Closers: "memories to last a lifetime", "a journey to remember", any flourish ending.
- No exclamation marks. No rhetorical questions.`;

// BAN list + default VOICE one-liner. Use this when the endpoint doesn't
// need to elaborate the voice rules further. Most endpoints want this.
export const LUXURY_VOICE_DISCIPLINE = `${LUXURY_VOICE_BANS}

VOICE: confident, factual, restrained. Operator voice, not brochure voice. One adjective per noun. Lead with concrete detail, not adjective.`;
