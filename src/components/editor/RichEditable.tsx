"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { sanitizeRichText } from "@/lib/sanitizeRichText";

// ─── RichEditable ────────────────────────────────────────────────────────
//
// A drop-in replacement for `<element contentEditable onBlur={save text}>`
// that lets inline formatting (color, font-size) round-trip through
// save / share / PDF. Old pattern stripped formatting because
// textContent only carries plain text.
//
// Two render paths:
//
//   • Editor mode — contentEditable element managed via ref + useEffect.
//     React renders the element empty; useEffect imperatively sets
//     innerHTML from the sanitised value. Critically, useEffect SKIPS
//     setting innerHTML when the DOM already matches — that's the case
//     mid-edit, and skipping there is what keeps the cursor alive.
//     onBlur reads the current innerHTML, sanitises, saves. React
//     never touches contentEditable's children directly.
//
//   • Preview / share / print — straight `dangerouslySetInnerHTML`
//     over the sanitised value. SSR-safe.
//
// The `as` prop picks the rendered tag; default <div>. All standard
// className / style / data-* pass through.

type SimpleTag = "div" | "span" | "p" | "h1" | "h2" | "h3" | "blockquote";

interface Props {
  value: string;
  onChange: (next: string) => void;
  isEditor: boolean;
  as?: SimpleTag;
  className?: string;
  style?: CSSProperties;
  /** Extra data-* attrs (e.g. data-ai-editable for AI targeting). */
  dataAttrs?: Record<string, string>;
}

export function RichEditable({
  value,
  onChange,
  isEditor,
  as: Tag = "div",
  className,
  style,
  dataAttrs,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isEditor) return;
    const el = ref.current;
    if (!el) return;
    const safe = sanitizeRichText(value);
    if (el.innerHTML !== safe) {
      el.innerHTML = safe;
    }
  }, [value, isEditor]);

  if (!isEditor) {
    return (
      <Tag
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
        {...(dataAttrs ?? {})}
      />
    );
  }

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        const html = sanitizeRichText((e.currentTarget as HTMLElement).innerHTML);
        if (html !== sanitizeRichText(value)) onChange(html);
      }}
      data-rich-text="true"
      {...(dataAttrs ?? {})}
    />
  );
}
