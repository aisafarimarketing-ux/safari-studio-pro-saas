// Safari Studio PDF render service.
//
// Tiny Express server that uses Playwright + Chromium to render a public
// proposal URL into a magazine-grade A4 PDF and pipes the bytes back.
//
// Diagnostic-rich: on failure, reports navigation status, console errors,
// and the last page URL seen, so the caller knows whether the issue is
// "URL returned 500", "timeout", or "browser crashed" without needing
// to tail logs.

import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const SECRET = process.env.PDF_SHARED_SECRET;

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      // Aggressive memory-conservation flags. Railway's entry-tier plans
      // give a service ~512MB of RAM; Chromium with a heavy SPA + fonts
      // will OOM without these. --single-process puts everything in one
      // process (lower memory, slightly less stable but fine for a
      // single-request-at-a-time PDF worker).
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--hide-scrollbars",
        "--metrics-recording-only",
        "--mute-audio",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--font-render-hinting=none",
        "--single-process",
        "--memory-pressure-off",
      ],
    });
    // Restart on unexpected close — lets us self-heal after OOM.
    browserPromise.then((b) =>
      b.on("disconnected", () => {
        console.warn("[pdf] browser disconnected; will relaunch on next request");
        browserPromise = null;
      }),
    );
  }
  return browserPromise;
}

app.get("/", (_req, res) => res.json({ status: "ok", service: "pdf" }));

// GET /diag?url=...  — dry run: just fetch the URL with Playwright and
// return the HTTP status, content-type, page title, and any console errors.
// Behind the same secret as /pdf. Useful when the full /pdf call 502s.
app.post("/diag", async (req, res) => {
  if (!SECRET) return res.status(500).json({ error: "PDF_SHARED_SECRET not configured" });
  const auth = req.header("authorization") || "";
  if (auth !== `Bearer ${SECRET}`) return res.status(401).json({ error: "Unauthorized" });

  const url = req.body?.url;
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "url is required (http/https)" });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1240, height: 1754 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const requestErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("requestfailed", (r) => requestErrors.push(`${r.url().slice(0, 120)} → ${r.failure()?.errorText}`));

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const title = await page.title().catch(() => "");
    const bodyLen = await page.evaluate(() => document.body?.innerText?.length ?? 0).catch(() => 0);
    res.json({
      ok: true,
      navigationStatus: response?.status() ?? null,
      contentType: response?.headers()["content-type"] ?? null,
      pageTitle: title,
      bodyTextLength: bodyLen,
      consoleErrors,
      requestErrors: requestErrors.slice(0, 10),
      finalUrl: page.url(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || "navigation failed",
      consoleErrors,
      requestErrors: requestErrors.slice(0, 10),
    });
  } finally {
    await context.close().catch(() => {});
  }
});

app.post("/pdf", async (req, res) => {
  if (!SECRET) return res.status(500).json({ error: "PDF_SHARED_SECRET not configured" });
  const auth = req.header("authorization") || "";
  if (auth !== `Bearer ${SECRET}`) return res.status(401).json({ error: "Unauthorized" });

  const url = req.body?.url;
  const filename = sanitize(req.body?.filename || "proposal.pdf");
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "url is required (http/https)" });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    // A4 at ~100dpi so Chromium doesn't allocate 4x the pixel buffer.
    // Tagged PDF output still scales vectors + fonts correctly, and
    // raster images remain sharp at 2x via deviceScaleFactor.
    viewport: { width: 1024, height: 1440 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
    javaScriptEnabled: true,
  });
  const page = await context.newPage();
  await page.emulateMedia({ media: "print" });

  // Capture diagnostic signal during the whole lifecycle.
  const consoleErrors = [];
  const requestErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("requestfailed", (r) => {
    requestErrors.push(`${r.url().slice(0, 120)} → ${r.failure()?.errorText}`);
  });

  let navigationStatus = null;

  try {
    // domcontentloaded + explicit readiness flag + fonts wait is much
    // lighter than networkidle — avoids holding a heavy page open while
    // third-party analytics / Clerk scripts keep the network "busy".
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    navigationStatus = response?.status() ?? null;

    if (navigationStatus && (navigationStatus < 200 || navigationStatus >= 400)) {
      throw new Error(
        `print page responded ${navigationStatus} at ${page.url()}`,
      );
    }

    // The print page sets window.__SS_READY__ after hydration, font load,
    // and image decode. That's all we need to know it's safe to capture.
    await page
      .waitForFunction(() => Boolean(window.__SS_READY__), { timeout: 25_000 })
      .catch(() => page.waitForTimeout(1200));

    await page.evaluate(async () => {
      try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      tagged: true,
      outline: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  } catch (err) {
    console.error("[pdf] render failed:", {
      url,
      navigationStatus,
      error: err?.message,
      consoleErrors: consoleErrors.slice(0, 5),
      requestErrors: requestErrors.slice(0, 5),
    });
    // Return a diagnostic-rich body so the main app can forward it to the
    // client and we can read "why" without tailing logs.
    res.status(500).json({
      error: err?.message || "Render failed",
      navigationStatus,
      consoleErrors: consoleErrors.slice(0, 5),
      requestErrors: requestErrors.slice(0, 5),
      finalUrl: page.url(),
    });
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
