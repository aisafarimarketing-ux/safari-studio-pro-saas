import type { Day, Proposal, TierKey } from "@/lib/types";

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
    const narrative = trimSentences(stripHtml(d.description ?? ""), 360);
    const stay = formatAccommodation(d, input.activeTier);
    const lines = [header];
    if (narrative) lines.push(narrative);
    if (stay) lines.push(stay);
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
