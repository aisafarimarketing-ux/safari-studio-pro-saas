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
      // Standard Railway-safe flags. No --single-process: it causes
      // Chromium to SIGSEGV on JS-heavy SPAs (ours has Clerk + React).
      // With 1GB+ available memory we can afford multi-process mode.
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-background-networking",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-first-run",
        "--font-render-hinting=none",
      ],
    });
    // Self-heal if the browser dies between requests.
    browserPromise.then(
      (b) =>
        b.on("disconnected", () => {
          console.warn("[pdf] browser disconnected; will relaunch on next request");
          browserPromise = null;
        }),
      (err) => {
        console.error("[pdf] browser launch failed:", err);
        browserPromise = null;
      },
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

  // Handler-level watchdog — if something hangs (Chromium wedged, a
  // content script stalls, anything) we return a clear message instead
  // of letting Railway's proxy time us out with a generic 502.
  const WATCHDOG_MS = 90_000;
  let watchdog;
  const watchdogPromise = new Promise((_, reject) => {
    watchdog = setTimeout(
      () => reject(new Error(`watchdog: render exceeded ${WATCHDOG_MS}ms`)),
      WATCHDOG_MS,
    );
  });

  let browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    console.error("[pdf] browser launch failed:", err);
    return res.status(500).json({ error: `browser launch failed: ${err?.message || err}` });
  }

  let context;
  try {
    // deviceScaleFactor = 1: every bitmap (hero photos, backgrounds) is
    // embedded at 1x instead of 2x. For a proposal with 15-25 photos this
    // is the difference between a 10MB PDF and a 50-60MB PDF. A4 at 1024
    // viewport still renders at ~125 DPI once scaled to print — plenty
    // sharp for on-screen viewing and typical letter-press printing, and
    // the text is vector so sharpness is independent of the factor.
    context = await browser.newContext({
      viewport: { width: 1024, height: 1440 },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "en-US",
      javaScriptEnabled: true,
    });
  } catch (err) {
    console.error("[pdf] newContext failed (likely dead browser):", err);
    // Force relaunch on next request.
    browserPromise = null;
    return res.status(500).json({
      error: `browser context failed: ${err?.message || err}. A fresh browser will launch on the next retry.`,
    });
  }
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
    const render = (async () => {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      navigationStatus = response?.status() ?? null;

      if (navigationStatus && (navigationStatus < 200 || navigationStatus >= 400)) {
        throw new Error(
          `print page responded ${navigationStatus} at ${page.url()}`,
        );
      }

      await page
        .waitForFunction(() => Boolean(window.__SS_READY__), { timeout: 25_000 })
        .catch(() => page.waitForTimeout(1200));

      await page.evaluate(async () => {
        try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
      });

      // Wait for every <img> in the DOM to finish decoding. Without this,
      // Leaflet map tiles + Supabase-hosted photos can still be pending
      // when page.pdf() fires, leaving grey rectangles where the map
      // should render. 6s per-image cap so one slow image can't hang the
      // whole render.
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll("img"));
        await Promise.all(imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return null;
          return new Promise((resolve) => {
            const done = () => resolve(null);
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 6000);
          });
        }));
      });

      // Network idle catches the Leaflet tile XHR batch specifically — the
      // map fires N tile requests in parallel and we need them all to
      // finish before snapshotting. 3s of no activity is a strong signal.
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

      return page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        tagged: true,
        outline: true,
      });
    })();

    const pdf = await Promise.race([render, watchdogPromise]);
    clearTimeout(watchdog);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  } catch (err) {
    clearTimeout(watchdog);
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
    // Crash-class errors → force a fresh browser on the next request.
    if (/Target closed|Navigation|watchdog|browser/i.test(err?.message || "")) {
      browserPromise = null;
    }
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
