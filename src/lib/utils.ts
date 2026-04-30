// ─── utils ─────────────────────────────────────────────────────────────
//
// Tiny shared helpers. Currently just `cn` for joining className lists,
// used by Shadcn-flavoured components.

type ClassValue = string | number | boolean | null | undefined;

/** Join class name fragments, dropping falsy values. Doesn't dedupe
 *  conflicting Tailwind classes — for our usage that's overkill;
 *  callers can structure conditionals to avoid conflicts. */
export function cn(...classes: Array<ClassValue | ClassValue[]>): string {
  const out: string[] = [];
  for (const c of classes) {
    if (Array.isArray(c)) {
      for (const inner of c) if (inner) out.push(String(inner));
    } else if (c) {
      out.push(String(c));
    }
  }
  return out.join(" ");
}
