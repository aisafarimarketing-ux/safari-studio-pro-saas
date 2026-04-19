// One-off helper: slice an enormously-tall screencapture PNG into page-sized
// chunks so the Read tool can actually rasterise them (it has a 2576px cap).
//
//   node scripts/split-screencapture.mjs <input.png> <outputDir> [stripHeight]
//
// Default strip height is 2200px to stay safely under the limit.

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [, , input, outDir, stripArg] = process.argv;
if (!input || !outDir) {
  console.error("usage: node split-screencapture.mjs <input.png> <outputDir> [stripHeight]");
  process.exit(1);
}

const stripHeight = Number(stripArg) || 2200;
fs.mkdirSync(outDir, { recursive: true });

const img = sharp(input);
const meta = await img.metadata();
console.log(`source: ${meta.width} × ${meta.height}`);
if (!meta.height || !meta.width) throw new Error("Could not read dimensions");

const count = Math.ceil(meta.height / stripHeight);
for (let i = 0; i < count; i++) {
  const top = i * stripHeight;
  const height = Math.min(stripHeight, meta.height - top);
  // Also downscale width so each strip stays small; target 1280px wide
  // which is enough for readable design analysis.
  const targetW = Math.min(1280, meta.width);
  const scale = targetW / meta.width;
  const outH = Math.round(height * scale);
  const outPath = path.join(outDir, `part-${String(i + 1).padStart(2, "0")}.png`);
  await sharp(input)
    .extract({ left: 0, top, width: meta.width, height })
    .resize({ width: targetW, height: outH, fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`wrote ${outPath} (${targetW} × ${outH})`);
}
