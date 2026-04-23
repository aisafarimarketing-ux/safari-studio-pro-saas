"use client";

// ─── Client-side PDF text extraction ──────────────────────────────────────
//
// Used by /import so operator proposals never touch our servers in their
// binary form. pdfjs-dist parses the file in the browser, we send only
// the extracted text to the API. Keeps sensitive client data (names,
// pricing, flight numbers) out of our server logs.
//
// The worker is loaded from unpkg pinned to the installed pdfjs version
// — avoids per-project bundler config and works uniformly across dev,
// Railway build, and Turbopack.

import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  if (typeof window === "undefined") return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  workerConfigured = true;
}

/**
 * Extract the raw text of a PDF file, in page order. Returns one page of
 * concatenated text per array entry so the caller can cap or chunk as
 * needed. Text-layout reconstruction (paragraphs, columns) is intentional
 * left to the downstream LLM — pdfjs gives us items with positions but
 * robust paragraph re-flow is its own rabbit hole and Claude handles
 * unsegmented text fine.
 */
export async function extractPdfPages(file: File | Blob): Promise<string[]> {
  ensureWorker();
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
 * with two-newline separators between pages. Pages caps at `maxPages` so
 * a pathologically long source can't blow the LLM's input window.
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
