"use client";

// ─── Client-side PDF text extraction ──────────────────────────────────────
//
// Used by /import so operator proposals never touch our servers in their
// binary form. pdfjs-dist parses the file in the browser, we send only
// the extracted text to the API. Keeps sensitive client data (names,
// pricing, flight numbers) out of our server logs.
//
// IMPORTANT: pdfjs-dist references DOMMatrix at module evaluation. A
// top-level `import * as pdfjsLib from "pdfjs-dist"` therefore crashes
// during Next.js SSR/prerender even on "use client" files, because the
// JS module still gets evaluated server-side for hydration boundary
// analysis. We lazy-import the module inside the call site — the
// dynamic import only fires in the browser when the user actually
// picks a PDF.

type PdfJs = typeof import("pdfjs-dist");
let pdfjsLibCached: PdfJs | null = null;

async function loadPdfJs(): Promise<PdfJs> {
  if (pdfjsLibCached) return pdfjsLibCached;
  const mod = (await import("pdfjs-dist")) as PdfJs;
  // Worker — pinned to the loaded version, served by unpkg so no bundler
  // config is needed. Turbopack + Next 16 compat: keep this outside any
  // build-time URL graph.
  mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`;
  pdfjsLibCached = mod;
  return mod;
}

/**
 * Extract the raw text of a PDF file, in page order. Text-layout
 * reconstruction (paragraphs, columns) is intentionally left to the
 * downstream LLM — pdfjs gives us items with positions but robust
 * paragraph re-flow is its own rabbit hole and Claude handles
 * unsegmented text fine.
 */
export async function extractPdfPages(file: File | Blob): Promise<string[]> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      pages.push(text);
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

/**
 * Convenience wrapper — returns the whole document as a single string
 * with two-newline separators between pages. `maxPages` caps page count
 * and `maxChars` caps the returned length so a pathologically long PDF
 * can't blow the LLM's input window.
 */
export async function extractPdfText(
  file: File | Blob,
  opts: { maxPages?: number; maxChars?: number } = {},
): Promise<string> {
  const { maxPages = 40, maxChars = 60_000 } = opts;
  const pages = await extractPdfPages(file);
  const joined = pages.slice(0, maxPages).join("\n\n").trim();
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
}
