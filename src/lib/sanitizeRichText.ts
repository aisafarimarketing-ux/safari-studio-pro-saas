// ─── sanitizeRichText ────────────────────────────────────────────────────
//
// Tight allow-list HTML sanitiser used by RichEditable text fields. The
// only formatting we accept is:
//
//   • <span> with an inline style attribute restricted to:
//       color, font-size, background-color, font-weight, font-style
//   • <br>
//   • Plain text nodes
//
// Anything else (other tags, scripts, attributes, classes, on* handlers)
// is stripped. Disallowed elements are UNWRAPPED — their text children
// survive, the wrapper goes — so an operator who pastes from Word
// keeps their words but loses the formatting bloat.
//
// Why a tight allow-list, not DOMPurify: we only need two style props
// to round-trip. A small allow-list keeps the saved HTML auditable
// and predictable across editor / share view / PDF.

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "font-size",
  "background-color",
  "font-weight",
  "font-style",
]);

const ALLOWED_TAGS = new Set(["span", "br"]);

export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";
  // Parse via a detached <template> so any malformed HTML or stray
  // tags get normalised by the browser parser. We never return the
  // parsed DOM directly — only its serialised, cleaned innerHTML.
  if (typeof window === "undefined") {
    // SSR / node environment — fall back to a regex strip. Server-side
    // rendering only needs to display, never to round-trip user input,
    // so the simpler scrub is enough here.
    return stripTagsFallback(input);
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = String(input);
  cleanNodeList(Array.from(tpl.content.childNodes));
  return tpl.innerHTML;
}

function cleanNodeList(nodes: ChildNode[]): void {
  for (const node of nodes) cleanNode(node);
}

function cleanNode(node: ChildNode): void {
  if (node.nodeType === Node.TEXT_NODE) return;
  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.remove();
    return;
  }
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) {
    // Unwrap — keep children, drop the element itself.
    const parent = el.parentNode;
    if (!parent) {
      el.remove();
      return;
    }
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
    return;
  }

  // Allow-listed tag — strip every attribute except a filtered style.
  const styleAttr = el.getAttribute("style") ?? "";
  for (const attr of Array.from(el.attributes)) {
    el.removeAttribute(attr.name);
  }
  if (tag === "span" && styleAttr) {
    const filtered = filterStyle(styleAttr);
    if (filtered) el.setAttribute("style", filtered);
    // If filtering produced nothing useful, leave the span attribute-
    // less. Subsequent passes can unwrap empty spans (operator
    // doesn't notice an empty span; React won't render it visibly).
  }
  // Recurse children. Clone first since cleanNode may remove nodes
  // mid-iteration.
  cleanNodeList(Array.from(el.childNodes));
}

function filterStyle(raw: string): string {
  // CSS declarations split on ";"; each is "prop: value". Lowercase
  // the property name; preserve the value as-is. Reject any that
  // aren't on the allow-list or that contain url(), expression(),
  // or javascript: (defence-in-depth).
  const out: string[] = [];
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) continue;
    if (value.length > 80) continue; // sanity cap
    out.push(`${prop}: ${value}`);
  }
  return out.join("; ");
}

function stripTagsFallback(input: string): string {
  // Server-side stripper — used for SSR rendering of pre-existing
  // saved HTML so we never inject raw markup before hydration.
  // Keeps text + line-break tags only.
  return String(input)
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<(?!\/?br\b|\/?span\b)[^>]*>/gi, "")
    .replace(/\s(on\w+|href|src)=("[^"]*"|'[^']*'|[^\s>]*)/gi, "");
}
