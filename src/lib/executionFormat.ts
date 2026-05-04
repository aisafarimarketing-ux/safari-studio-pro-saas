import type { Day, PricingData, Proposal, TierKey } from "@/lib/types";

// ─── Snippet formatters — deterministic, no LLM ─────────────────────────────
//
// The operator hits the command bar with "send Jennifer day 2 and 3";
// the server has already retrieved the matching Day rows. This module
// renders those rows into a sendable string — WhatsApp plain text or
// HTML email — using the operator's existing brand context where it
// helps. Pure functions so the same inputs always yield the same
// output: testable, debuggable, and impossible to hallucinate from.

export type SnippetChannel = "whatsapp" | "email";

export type FormatInput = {
  days: Day[];
  channel: SnippetChannel;
  /** First name only — keeps the greeting natural ("Hi Jennifer"). */
  clientFirstName: string;
  tripTitle: string;
  /** The proposal's selected tier — picks which accommodation to surface. */
  activeTier: TierKey;
  /** Operator's name for the sign-off line. Optional; we omit the line
   *  when missing rather than seeding "Best, undefined". */
  operatorFirstName: string | null;
};

export type FormattedSnippet = {
  /** Plain-text body. WhatsApp uses this as-is; email uses it as the
   *  text/plain alternative. */
  text: string;
  /** HTML body. Only used by email. */
  html: string;
  /** Email subject. Empty string when channel === "whatsapp". */
  subject: string;
};

export function formatProposalDaysSnippet(input: FormatInput): FormattedSnippet {
  if (input.channel === "whatsapp") {
    return formatWhatsApp(input);
  }
  return formatEmail(input);
}

// ─── WhatsApp ───────────────────────────────────────────────────────────────
//
// Plain text. No HTML, no markdown — WhatsApp doesn't render either
// reliably across devices. Two short paragraphs per day max:
//   1. "Day N — Destination" header line
//   2. Trimmed narrative (one paragraph, sentence-bounded if possible)
//   3. Optional accommodation line ("Stay: <camp>")
// Greeting + sign-off bookend the days.

function formatWhatsApp(input: FormatInput): FormattedSnippet {
  const greeting = `Hi ${input.clientFirstName} — here ${
    input.days.length === 1 ? "is day" : "are days"
  } ${formatDayList(input.days)} of your ${input.tripTitle}:`;

  const dayBlocks = input.days.map((d) => {
    const header = `Day ${d.dayNumber}${d.destination ? ` — ${d.destination}` : ""}`;
    const narrative = cleanWhatsAppMarkdown(
      trimSentences(stripHtml(d.description ?? ""), 360),
    );
    const stay = formatAccommodation(d, input.activeTier);
    const cleanedStay = stay ? cleanWhatsAppMarkdown(stay) : null;
    const lines = [header];
    if (narrative) lines.push(narrative);
    if (cleanedStay) lines.push(cleanedStay);
    return lines.join("\n");
  });

  const closing = "Let me know if you have any questions on either.";
  const signOff = input.operatorFirstName ? `\n— ${input.operatorFirstName}` : "";

  const text = [greeting, "", ...interleave(dayBlocks, ""), "", closing + signOff]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, html: "", subject: "" };
}

// Convert markdown emphasis to WhatsApp's flavour (single-character
// wrappers) and strip anything that would render as literal punctuation.
// WhatsApp's syntax:
//   *bold*       — single asterisks
//   _italic_     — single underscores
//   ~strikethrough~
//   ```code```   — triple backticks
//
// Operators paste `**bold**` from external editors all the time; left
// untouched, those double asterisks render as literal text in
// WhatsApp because the parser treats them as escaped. We translate
// the common markdown patterns and drop stragglers so the output is
// clean every time. Deterministic — no AI, no content rewrites.
function cleanWhatsAppMarkdown(input: string): string {
  if (!input) return "";
  let s = input;

  // Bold variants: **text** and __text__ → *text*
  // Non-greedy match, single line, requires non-asterisk content so
  // we don't collapse `**` adjacencies into something weird.
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, "*$1*");
  s = s.replace(/__([^_\n]+?)__/g, "*$1*");

  // Italic variants: *text* already correct for WhatsApp; _text_ is
  // already correct too. Leave them alone — they're either valid
  // WhatsApp markup or harmless punctuation.

  // Triple backticks → strip the fences but keep the code text.
  // WhatsApp's ``` rendering is fine when supported, but operators
  // rarely use it for prose; safer to flatten.
  s = s.replace(/```([^`]+?)```/g, "$1");

  // Inline backticks `code` → strip backticks (WhatsApp renders fine
  // either way; consistency wins).
  s = s.replace(/`([^`\n]+?)`/g, "$1");

  // Markdown headings (#, ##, ###) — strip the leading hashes plus
  // the space. Day cards already have header lines we own; any
  // operator-typed `## Highlights` would leak the literal hashes.
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Markdown list bullets at line start: "- ", "* ", "+ " → keep the
  // bullet but normalise to "• " for cleaner WhatsApp display. Skip
  // when the line already starts with "•" or is part of a continued
  // sentence.
  s = s.replace(/^([-*+])\s+/gm, "• ");

  // Stray double-asterisk / double-underscore artifacts left over from
  // unbalanced markdown. Drop them so the message is never corrupted
  // by visible markup.
  s = s.replace(/\*\*+/g, "");
  s = s.replace(/__+/g, "");

  return s;
}

// ─── Email ──────────────────────────────────────────────────────────────────
//
// Lightly structured HTML — header per day, narrative paragraph,
// accommodation line in muted text. The text alternative is the
// WhatsApp version (same content, different framing) so a recipient
// in a plain-text reader gets a coherent message too.

function formatEmail(input: FormatInput): FormattedSnippet {
  // Subject deliberately specific. "Following up on your safari" is
  // banned by the brand-voice rules; "Days 2 and 3 of your safari" is
  // concrete enough that the recipient knows to open.
  const subject =
    input.days.length === 1
      ? `Day ${input.days[0].dayNumber} of your ${input.tripTitle}`
      : `${formatDaysWord(input.days)} of your ${input.tripTitle}`;

  const greeting = `<p style="margin:0 0 14px;">Hi ${escapeHtml(input.clientFirstName)} — sharing ${
    input.days.length === 1 ? "day" : "days"
  } ${escapeHtml(formatDayList(input.days))} of your <strong>${escapeHtml(input.tripTitle)}</strong>:</p>`;

  const dayBlocks = input.days.map((d) => {
    const header = `Day ${d.dayNumber}${d.destination ? ` — ${escapeHtml(d.destination)}` : ""}`;
    const narrative = stripHtml(d.description ?? "").trim();
    const narrativeHtml = narrative
      ? `<p style="margin:0 0 8px;line-height:1.55;color:#0a1411;">${escapeHtml(narrative)}</p>`
      : "";
    const stay = formatAccommodation(d, input.activeTier);
    const stayHtml = stay
      ? `<p style="margin:0 0 18px;font-size:13px;color:rgba(10,20,17,0.6);"><strong>Stay:</strong> ${escapeHtml(stay.replace(/^Stay:\s*/i, ""))}</p>`
      : "";
    return `
      <div style="margin:0 0 14px;">
        <h3 style="margin:0 0 6px;font-size:14.5px;color:#0a1411;font-family:'Playfair Display',Georgia,serif;letter-spacing:-0.005em;">${header}</h3>
        ${narrativeHtml}
        ${stayHtml}
      </div>
    `;
  });

  const closing = `<p style="margin:18px 0 0;color:#0a1411;">Let me know if you have any questions on either.</p>`;
  const signOff = input.operatorFirstName
    ? `<p style="margin:14px 0 0;color:rgba(10,20,17,0.7);">— ${escapeHtml(input.operatorFirstName)}</p>`
    : "";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14.5px;color:#0a1411;line-height:1.5;">
      ${greeting}
      ${dayBlocks.join("")}
      ${closing}
      ${signOff}
    </div>
  `.replace(/\s+\n/g, "\n").trim();

  // Plain-text alternative reuses the WhatsApp rendering — same
  // content, different sender framing. This is the version that
  // shows in the FollowUpPanel preview's textarea, so it must stay
  // operator-readable.
  const textVariant = formatWhatsApp(input).text;

  return { text: textVariant, html, subject };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAccommodation(day: Day, activeTier: TierKey): string | null {
  const tier = day.tiers?.[activeTier];
  if (!tier) return null;
  const camp = tier.camp?.trim();
  if (!camp) return null;
  const location = tier.location?.trim();
  return location ? `Stay: ${camp} (${location})` : `Stay: ${camp}`;
}

function formatDayList(days: Day[]): string {
  const numbers = days.map((d) => d.dayNumber);
  if (numbers.length === 1) return String(numbers[0]);
  if (numbers.length === 2) return `${numbers[0]} and ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

function formatDaysWord(days: Day[]): string {
  return `Days ${formatDayList(days)}`;
}

// Trim a paragraph to roughly maxChars without cutting mid-word, and
// prefer to end on a sentence boundary when possible. Keeps WhatsApp
// snippets short without sacrificing voice.
function trimSentences(s: string, maxChars: number): string {
  const trimmed = s.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
  );
  if (lastSentenceEnd >= maxChars * 0.5) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= 0) return `${slice.slice(0, lastSpace).trim()}…`;
  return `${slice.trim()}…`;
}

function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function interleave<T>(items: T[], sep: T): T[] {
  if (items.length === 0) return items;
  const out: T[] = [];
  items.forEach((it, i) => {
    if (i > 0) out.push(sep);
    out.push(it);
  });
  return out;
}

// Re-exported for the API route's use — Proposal type isn't needed
// here, but keeping the import surface consistent across execution-AI
// modules makes it easier to swap in a different proposal source
// later (e.g. a saved snippet template).
export type { Proposal };

// ─── Pricing summary — deterministic breakdown ─────────────────────────────
//
// Sibling of formatProposalDaysSnippet for the "send pricing to X"
// command. Reads the same proposal contentJson (PricingData +
// inclusions/exclusions + trip.nights + client.adults) and produces
// a calm, mobile-friendly breakdown that anchors with the total
// trip cost first, then frames value (3–6 inclusions), removes
// uncertainty (≤4 exclusions), adds one grounding line, and closes
// with a soft invitation.
//
// No AI generation. No copy-rewriting. No markdown emphasis on the
// rendered WhatsApp output — operators paste copy through here all
// the time and stray `**bold**` from external editors looked like
// literal punctuation on phones. Headers are plain text; bullets are
// "•".
//
// Tier choice: always uses proposal.activeTier. Operators who want to
// surface alternative tiers can edit in the FollowUpPanel preview
// before dispatching.

export type PricingContextHint =
  | "hesitation"
  | "comparison"
  | "confusion"
  | null;

export type PricingFormatInput = {
  channel: SnippetChannel;
  clientFirstName: string;
  tripTitle: string;
  pricing: PricingData;
  activeTier: TierKey;
  inclusions: string[];
  exclusions: string[];
  /** Adult count from proposal.contentJson.client.adults — the
   *  formatter multiplies pricePerPerson × adults to anchor the
   *  message with a total trip cost. When missing, the WhatsApp
   *  layout falls back to a per-person-only headline. */
  adults: number | null;
  /** Total nights from proposal.contentJson.trip.nights — appended
   *  to the total line as "for N nights". Optional. */
  nights: number | null;
  /** Behaviour-derived context that picks the reassurance line.
   *  Caller passes the result of derivePricingContext (executionTools);
   *  null defaults to "comparison" — the safest neutral framing. */
  context: PricingContextHint;
  operatorFirstName: string | null;
};

export function formatPricingSnippet(
  input: PricingFormatInput,
): FormattedSnippet {
  if (input.channel === "whatsapp") {
    return formatPricingWhatsApp(input);
  }
  return formatPricingEmail(input);
}

// Reassurance copy, picked from the behaviour-derived context.
// Deterministic — the formatter never randomises so the same
// proposal + same context always yields the same line. Caller passes
// the context; null falls back to "comparison" because that's the
// most neutral framing for a no-data send.
const PRICING_REASSURANCE: Record<
  Exclude<PricingContextHint, null>,
  string
> = {
  hesitation: "We can adjust this depending on what matters most to you.",
  comparison: "This should give a clear sense of how the trip is structured.",
  confusion: "Happy to clarify anything that isn't clear.",
};
function pickReassurance(context: PricingContextHint): string {
  return PRICING_REASSURANCE[context ?? "comparison"];
}

// Stronger closing — replaces the previous passive "Let me know if
// you'd like me to adjust anything." Active phrasing, low friction.
const PRICING_CLOSING = "Happy to walk through it with you if helpful.";

function formatPricingWhatsApp(input: PricingFormatInput): FormattedSnippet {
  const tier = input.pricing[input.activeTier];
  const currency = tier?.currency?.trim() || "";
  const perPersonRaw = tier?.pricePerPerson?.trim() ?? "";
  const perPersonNumber = parsePrice(perPersonRaw);
  const adults = input.adults && input.adults > 0 ? input.adults : null;
  const total =
    adults !== null && perPersonNumber !== null
      ? perPersonNumber * adults
      : null;
  const nights = input.nights && input.nights > 0 ? input.nights : null;

  const greeting = `Hi ${input.clientFirstName} — here's a clear breakdown of your safari pricing:`;

  const blocks: string[] = [];

  // ── Pricing block (total first, anchor)
  const priceLines: string[] = [];
  if (total !== null) {
    priceLines.push(
      nights !== null
        ? `Total: ${formatMoney(currency, total)} for ${nights} ${nights === 1 ? "night" : "nights"}`
        : `Total: ${formatMoney(currency, total)}`,
    );
    if (perPersonNumber !== null) {
      priceLines.push(`≈ ${formatMoney(currency, perPersonNumber)} per person`);
    }
  } else if (perPersonNumber !== null) {
    priceLines.push(`Per person: ${formatMoney(currency, perPersonNumber)}`);
  } else if (perPersonRaw) {
    // Couldn't parse to a number, but the operator typed something —
    // fall back to printing it verbatim with the currency code.
    priceLines.push(
      `Per person: ${currency ? `${currency} ${perPersonRaw}` : perPersonRaw}`,
    );
  }
  if (priceLines.length > 0) blocks.push(priceLines.join("\n"));

  // ── What's included (capped 6)
  const inclusions = filterCleanList(input.inclusions, 6).map(plainifyForPricing);
  if (inclusions.length > 0) {
    blocks.push(["What's included", ...inclusions.map((s) => `• ${s}`)].join("\n"));
  }

  // ── What's not included (capped 4)
  const exclusions = filterCleanList(input.exclusions, 4).map(plainifyForPricing);
  if (exclusions.length > 0) {
    blocks.push(["What's not included", ...exclusions.map((s) => `• ${s}`)].join("\n"));
  }

  // ── Adaptive reassurance line (picked from context)
  blocks.push(pickReassurance(input.context));

  const signOff = input.operatorFirstName ? `\n— ${input.operatorFirstName}` : "";

  const text = [greeting, "", ...interleave(blocks, ""), "", PRICING_CLOSING + signOff]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, html: "", subject: "" };
}

function formatPricingEmail(input: PricingFormatInput): FormattedSnippet {
  const tier = input.pricing[input.activeTier];
  const currency = tier?.currency?.trim() || "";
  const perPersonRaw = tier?.pricePerPerson?.trim() ?? "";
  const perPersonNumber = parsePrice(perPersonRaw);
  const adults = input.adults && input.adults > 0 ? input.adults : null;
  const total =
    adults !== null && perPersonNumber !== null
      ? perPersonNumber * adults
      : null;
  const nights = input.nights && input.nights > 0 ? input.nights : null;

  const subject = `Pricing for your ${input.tripTitle}`;
  const greeting = `<p style="margin:0 0 14px;">Hi ${escapeHtml(input.clientFirstName)} — here's a clear breakdown of your safari pricing:</p>`;

  const blocks: string[] = [];

  // ── Total / per-person headline
  if (total !== null) {
    const totalLine = nights !== null
      ? `${formatMoney(currency, total)} for ${nights} ${nights === 1 ? "night" : "nights"}`
      : formatMoney(currency, total);
    const perPersonLine = perPersonNumber !== null
      ? `<div style="font-size:13px;color:rgba(10,20,17,0.65);margin-top:4px;">≈ ${escapeHtml(formatMoney(currency, perPersonNumber))} per person</div>`
      : "";
    blocks.push(`
      <div style="margin:0 0 18px;">
        <div style="font-size:12.5px;letter-spacing:0.04em;text-transform:uppercase;color:rgba(10,20,17,0.55);">Total</div>
        <div style="font-size:20px;font-weight:600;color:#0a1411;">${escapeHtml(totalLine)}</div>
        ${perPersonLine}
      </div>
    `);
  } else if (perPersonNumber !== null || perPersonRaw) {
    const headline = perPersonNumber !== null
      ? formatMoney(currency, perPersonNumber)
      : currency ? `${currency} ${perPersonRaw}` : perPersonRaw;
    blocks.push(`
      <div style="margin:0 0 18px;">
        <div style="font-size:12.5px;letter-spacing:0.04em;text-transform:uppercase;color:rgba(10,20,17,0.55);">Per person</div>
        <div style="font-size:18px;font-weight:600;color:#0a1411;">${escapeHtml(headline)}</div>
      </div>
    `);
  }

  // ── What's included
  const inclusions = filterCleanList(input.inclusions, 6).map(plainifyForPricing);
  if (inclusions.length > 0) {
    const items = inclusions
      .map((s) => `<li style="margin:0 0 4px;">${escapeHtml(s)}</li>`)
      .join("");
    blocks.push(`
      <div style="margin:0 0 18px;">
        <h3 style="margin:0 0 8px;font-size:14.5px;color:#0a1411;font-family:'Playfair Display',Georgia,serif;letter-spacing:-0.005em;">What's included</h3>
        <ul style="margin:0;padding-left:18px;line-height:1.55;color:#0a1411;">${items}</ul>
      </div>
    `);
  }

  // ── What's not included
  const exclusions = filterCleanList(input.exclusions, 4).map(plainifyForPricing);
  if (exclusions.length > 0) {
    const items = exclusions
      .map((s) => `<li style="margin:0 0 4px;">${escapeHtml(s)}</li>`)
      .join("");
    blocks.push(`
      <div style="margin:0 0 18px;">
        <h3 style="margin:0 0 8px;font-size:14.5px;color:#0a1411;font-family:'Playfair Display',Georgia,serif;letter-spacing:-0.005em;">What's not included</h3>
        <ul style="margin:0;padding-left:18px;line-height:1.55;color:#0a1411;">${items}</ul>
      </div>
    `);
  }

  // ── Reassurance line (adaptive)
  blocks.push(
    `<p style="margin:0 0 14px;color:#0a1411;">${escapeHtml(pickReassurance(input.context))}</p>`,
  );

  const closing = `<p style="margin:18px 0 0;color:#0a1411;">${escapeHtml(PRICING_CLOSING)}</p>`;
  const signOff = input.operatorFirstName
    ? `<p style="margin:14px 0 0;color:rgba(10,20,17,0.7);">— ${escapeHtml(input.operatorFirstName)}</p>`
    : "";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14.5px;color:#0a1411;line-height:1.5;">
      ${greeting}
      ${blocks.join("")}
      ${closing}
      ${signOff}
    </div>
  `.replace(/\s+\n/g, "\n").trim();

  // Plain-text alternative reuses the WhatsApp rendering — same
  // structure, different framing.
  const textVariant = formatPricingWhatsApp(input).text;
  return { text: textVariant, html, subject };
}

// Strip everything that isn't a digit or a decimal point and parse.
// Handles "4250", "4,250", "$4,250", "USD 4250.00" — returns null on
// anything that doesn't yield a positive finite number.
function parsePrice(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// "USD 12,750" / "12,750" depending on whether currency is present.
// No fractional digits — pricing displays drop cents to keep the
// line short on phones.
function formatMoney(currency: string, amount: number): string {
  const formatted = Math.round(amount).toLocaleString("en-US");
  return currency ? `${currency} ${formatted}` : formatted;
}

// Plainify operator-typed copy for the new WhatsApp pricing layout —
// strip ALL emphasis (`**bold**` → bare text, `*single*` → bare text)
// since the new format calls for no markdown anywhere. Bullets and
// other cleanWhatsAppMarkdown normalisations still apply because we
// run that pass first.
function plainifyForPricing(s: string): string {
  return cleanWhatsAppMarkdown(s).replace(/\*([^*\n]+?)\*/g, "$1");
}

// Light cleanup of operator-supplied lists. Strips HTML, drops empties,
// trims, and caps to a max so a runaway list doesn't bloat the message.
function filterCleanList(items: string[] | undefined, max: number): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((s) => stripHtml(s ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}

// ─── Preview-itinerary snippets — Exploration Mode ──────────────────────
//
// Sibling of formatProposalDaysSnippet for the canonical preview
// itineraries (no proposal needed). Same WhatsApp markdown discipline
// + same channel split (whatsapp = plain text, email = HTML).
//
// The canonical itinerary's days[] shape is intentionally simpler than
// a full Proposal Day (no tier accommodation, no hero image, no
// transfer/board metadata). This formatter expects that simpler shape
// and produces a slightly shorter snippet — the preview is a teaser,
// not a brief.

export type PreviewSnippetDay = {
  dayNumber: number;
  destination: string;
  description: string;
  accommodation?: string;
};

export type PreviewFormatInput = {
  days: PreviewSnippetDay[];
  channel: SnippetChannel;
  /** Lower-case phrase for the greeting line — "5-day safari",
   *  "honeymoon safari", etc. Inserted into "...what a typical
   *  {phrase} looks like". */
  itineraryPhrase: string;
  /** Operator-facing label used in the email subject line. Pass the
   *  PreviewItinerary.label as-is. */
  itineraryLabel: string;
  clientFirstName: string;
  operatorFirstName: string | null;
};

export function formatPreviewSnippet(
  input: PreviewFormatInput,
): FormattedSnippet {
  if (input.channel === "whatsapp") {
    return formatPreviewWhatsApp(input);
  }
  return formatPreviewEmail(input);
}

function formatPreviewWhatsApp(input: PreviewFormatInput): FormattedSnippet {
  const greeting = `Hi ${input.clientFirstName} — here's what a typical ${input.itineraryPhrase} looks like with us:`;

  const dayBlocks = input.days.map((d) => {
    const header = `Day ${d.dayNumber}${d.destination ? ` — ${d.destination}` : ""}`;
    const narrative = cleanWhatsAppMarkdown(
      trimSentences(stripHtml(d.description ?? ""), 320),
    );
    const stay = d.accommodation
      ? cleanWhatsAppMarkdown(`Stay: ${d.accommodation}`)
      : null;
    const lines = [header];
    if (narrative) lines.push(narrative);
    if (stay) lines.push(stay);
    return lines.join("\n");
  });

  const closing = "Let me know if you'd like me to tailor this for you.";
  const signOff = input.operatorFirstName ? `\n— ${input.operatorFirstName}` : "";

  const text = [greeting, "", ...interleave(dayBlocks, ""), "", closing + signOff]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, html: "", subject: "" };
}

function formatPreviewEmail(input: PreviewFormatInput): FormattedSnippet {
  // Subject is concrete on purpose — no "Following up" / "Just sharing".
  const subject = `What a typical ${input.itineraryLabel} looks like`;

  const greeting = `<p style="margin:0 0 14px;">Hi ${escapeHtml(input.clientFirstName)} — sharing what a typical <strong>${escapeHtml(input.itineraryLabel)}</strong> looks like with us:</p>`;

  const dayBlocks = input.days.map((d) => {
    const header = `Day ${d.dayNumber}${d.destination ? ` — ${escapeHtml(d.destination)}` : ""}`;
    const narrative = stripHtml(d.description ?? "").trim();
    const narrativeHtml = narrative
      ? `<p style="margin:0 0 8px;line-height:1.55;color:#0a1411;">${escapeHtml(narrative)}</p>`
      : "";
    const stayHtml = d.accommodation
      ? `<p style="margin:0 0 18px;font-size:13px;color:rgba(10,20,17,0.6);"><strong>Stay:</strong> ${escapeHtml(d.accommodation)}</p>`
      : "";
    return `
      <div style="margin:0 0 14px;">
        <h3 style="margin:0 0 6px;font-size:14.5px;color:#0a1411;font-family:'Playfair Display',Georgia,serif;letter-spacing:-0.005em;">${header}</h3>
        ${narrativeHtml}
        ${stayHtml}
      </div>
    `;
  });

  const closing = `<p style="margin:18px 0 0;color:#0a1411;">Let me know if you'd like me to tailor this for you.</p>`;
  const signOff = input.operatorFirstName
    ? `<p style="margin:14px 0 0;color:rgba(10,20,17,0.7);">— ${escapeHtml(input.operatorFirstName)}</p>`
    : "";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14.5px;color:#0a1411;line-height:1.5;">
      ${greeting}
      ${dayBlocks.join("")}
      ${closing}
      ${signOff}
    </div>
  `.replace(/\s+\n/g, "\n").trim();

  // Plain-text alternative for email clients that strip HTML.
  const textVariant = formatPreviewWhatsApp(input).text;
  return { text: textVariant, html, subject };
}
