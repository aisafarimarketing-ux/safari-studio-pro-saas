// Safari Studio PDF render service.
//
// Tiny Express server that uses Playwright to render a public proposal URL
// (e.g. https://safari-studio-pro.up.railway.app/p/abc123/print) into an
// A4 PDF and pipes the bytes back. Deploy as a separate Railway service:
// the main Next.js app calls POST /pdf with the URL it wants rendered.
//
// Auth: a shared secret in `Authorization: Bearer <PDF_SHARED_SECRET>`.
// Both the main app and this service set the same env var. Without it,
// the endpoint refuses to render.

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
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserPromise;
}

app.get("/", (_req, res) => res.json({ status: "ok", service: "pdf" }));

app.post("/pdf", async (req, res) => {
  // Auth gate
  if (!SECRET) {
    return res.status(500).json({ error: "PDF_SHARED_SECRET not configured" });
  }
  const auth = req.header("authorization") || "";
  if (auth !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const url = req.body?.url;
  const filename = req.body?.filename || "proposal.pdf";
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "url is required (http/https)" });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1240, height: 1754 }, // ~A4 @ 150dpi
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    // Wait for the print page to flag itself ready (set in
    // src/app/p/[id]/print/page.tsx). Falls back to a short delay.
    await page
      .waitForFunction(() => Boolean(window.__SS_READY__), { timeout: 15_000 })
      .catch(() => page.waitForTimeout(800));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error("[pdf]", err);
    res.status(500).json({ error: err?.message || "Render failed" });
  } finally {
    await context.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`PDF service listening on :${PORT}`);
});
