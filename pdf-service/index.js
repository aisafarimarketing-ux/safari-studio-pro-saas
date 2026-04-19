// Safari Studio PDF render service.
//
// Tiny Express server that uses Playwright + Chromium to render a public
// proposal URL (e.g. https://safari-studio.up.railway.app/p/abc123/print)
// into a magazine-grade A4 PDF and pipes the bytes back. Deploy as a
// separate Railway service: the main Next.js app calls POST /pdf with the
// URL it wants rendered.
//
// Output quality decisions:
//  - A4 @ 150dpi → 1240 × 1754 viewport with deviceScaleFactor 2 (so
//    raster assets render at ~300 effective dpi).
//  - preferCSSPageSize honours the @page rules defined on the print page.
//  - printBackground preserves the proposal's background colours and
//    images — without this, theme colours disappear.
//  - Fonts are awaited via document.fonts.ready + __SS_READY__ before
//    capture so the PDF never renders with FOUC glyphs.
//  - Zero margins: the print page controls its own bleed and padding.
//
// Auth: shared secret in `Authorization: Bearer <PDF_SHARED_SECRET>`.

import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const SECRET = process.env.PDF_SHARED_SECRET;

// Reuse a single browser instance — startup is the slow part. Lazy-init so
// boot doesn't block on browser launch.
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });
  }
  return browserPromise;
}

app.get("/", (_req, res) => res.json({ status: "ok", service: "pdf" }));

app.post("/pdf", async (req, res) => {
  if (!SECRET) {
    return res.status(500).json({ error: "PDF_SHARED_SECRET not configured" });
  }
  const auth = req.header("authorization") || "";
  if (auth !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const url = req.body?.url;
  const filename = sanitize(req.body?.filename || "proposal.pdf");
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "url is required (http/https)" });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    // A4 at 150dpi ≈ 1240 × 1754. Device-scale 2 doubles it for crisp
    // rasterisation.
    viewport: { width: 1240, height: 1754 },
    deviceScaleFactor: 2,
    // Force screen (not print) media — our print stylesheet is already
    // written with @media print guards; screen rendering + @page size is
    // what produces the best PDF fidelity across Chromium versions.
    colorScheme: "light",
    reducedMotion: "reduce",
    // Locale defaults to en-US; most proposals use English formatting.
    locale: "en-US",
  });

  // Emulate the `print` media type so any @media print rules also apply
  // in addition to the screen rules — the print page layers both.
  // (Playwright's page.emulateMedia comes after page creation.)
  const page = await context.newPage();
  await page.emulateMedia({ media: "print" });

  try {
    // networkidle waits for all loaded sub-resources to finish; the
    // SPA's data fetch settles here.
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

    // Our print page sets window.__SS_READY__ once fonts + images have
    // settled. Wait for that signal; fall back to a 1.5s timer if for
    // any reason it never fires.
    await page
      .waitForFunction(() => Boolean(window.__SS_READY__), { timeout: 20_000 })
      .catch(() => page.waitForTimeout(1500));

    // Belt-and-braces: force every font to finish loading before capture.
    await page.evaluate(async () => {
      try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      // Tagged PDFs are accessibility-friendlier and preserve the
      // document outline in viewers like Preview / Adobe.
      tagged: true,
      // Outline = the sidebar bookmark tree from headings.
      outline: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  } catch (err) {
    console.error("[pdf]", err);
    res.status(500).json({ error: err?.message || "Render failed" });
  } finally {
    await context.close().catch(() => {});
  }
});

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "proposal.pdf";
}

app.listen(PORT, () => {
  console.log(`PDF service listening on :${PORT}`);
});
