import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

// POST /api/media/seed-global
//
// One-time idempotent seed of the *global* destination media library —
// the records every organization sees as a baseline. Authenticated
// because we don't want public seed-spam, but not org-scoped (writes
// to organizationId: null rows).
//
// Image URLs are deliberately data-URI SVG placeholders. They're real,
// non-hallucinated URLs that always resolve, render legibly, and signal
// to operators that they should swap in their own properly-licensed
// photography from the destination-media management UI (next commit).
// The seed's job is to wire up the architecture, not to ship licensed
// imagery — that's an operator decision.

const SEED: SeedRow[] = [
  {
    locationName: "Serengeti",
    country: "Tanzania",
    animalType: "lion",
    category: "wildlife",
    tags: ["lion", "big-cats", "savannah"],
    experienceType: "game_drive",
    priorityScore: 10,
  },
  {
    locationName: "Tarangire",
    country: "Tanzania",
    animalType: "elephant",
    category: "wildlife",
    tags: ["elephant", "baobab", "dry-season"],
    experienceType: "game_drive",
    priorityScore: 10,
  },
  {
    locationName: "Ngorongoro",
    country: "Tanzania",
    animalType: null,
    category: "landscape",
    tags: ["crater", "caldera", "panorama"],
    experienceType: "game_drive",
    priorityScore: 10,
  },
  {
    locationName: "Zanzibar",
    country: "Tanzania",
    animalType: null,
    category: "beach",
    tags: ["beach", "indian-ocean", "dhow"],
    experienceType: "beach",
    priorityScore: 10,
  },
  {
    locationName: "Nairobi",
    country: "Kenya",
    animalType: null,
    category: "city",
    tags: ["airport", "arrival", "transfer"],
    experienceType: "arrival",
    priorityScore: 5,
  },
  {
    locationName: "Masai Mara",
    country: "Kenya",
    animalType: "lion",
    category: "wildlife",
    tags: ["lion", "migration", "savannah", "river-crossing"],
    experienceType: "game_drive",
    priorityScore: 10,
  },
  {
    locationName: "Amboseli",
    country: "Kenya",
    animalType: "elephant",
    category: "wildlife",
    tags: ["elephant", "kilimanjaro", "tuskers"],
    experienceType: "game_drive",
    priorityScore: 10,
  },
];

type SeedRow = {
  locationName: string;
  country: string;
  animalType: string | null;
  category: string;
  tags: string[];
  experienceType: string;
  priorityScore: number;
};

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Idempotent: count existing global rows. If the seed has already been
  // run once we don't duplicate.
  const existingCount = await prisma.destinationMediaAsset.count({
    where: { organizationId: null },
  });
  if (existingCount >= SEED.length) {
    return NextResponse.json({ ok: true, seeded: 0, alreadyPresent: existingCount });
  }

  // Check which seed rows we already have (by locationName + animalType + category).
  const existing = await prisma.destinationMediaAsset.findMany({
    where: { organizationId: null },
    select: { locationName: true, animalType: true, category: true },
  });
  const isAlreadyThere = (row: SeedRow) =>
    existing.some(
      (e) =>
        e.locationName?.toLowerCase() === row.locationName.toLowerCase() &&
        (e.animalType ?? null) === row.animalType &&
        e.category === row.category,
    );

  const toCreate = SEED.filter((row) => !isAlreadyThere(row));
  if (toCreate.length === 0) {
    return NextResponse.json({ ok: true, seeded: 0, alreadyPresent: existingCount });
  }

  const created = await prisma.destinationMediaAsset.createMany({
    data: toCreate.map((row) => ({
      organizationId: null,
      locationName: row.locationName,
      country: row.country,
      animalType: row.animalType,
      category: row.category,
      tags: row.tags,
      experienceType: row.experienceType,
      priorityScore: row.priorityScore,
      provider: "placeholder",
      attributionText: `Placeholder for ${row.locationName} — replace with licensed photography.`,
      imageUrl: placeholderSvg(row.locationName, row.country),
      thumbnailUrl: null,
      width: 1600,
      height: 1000,
    })),
  });

  return NextResponse.json({ ok: true, seeded: created.count });
}

// ─── Placeholder generation ─────────────────────────────────────────────────
//
// Returns a data-URI SVG showing the destination name on a forest-green
// background. Renders identically everywhere, never 404s, makes it obvious
// the row is awaiting real photography.

function placeholderSvg(location: string, country: string): string {
  const w = 1600;
  const h = 1000;
  const fg = "#c9a84c";
  const bg = "#1b3a2d";
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <g fill="${fg}" opacity="0.07">
    ${gridDots(w, h)}
  </g>
  <text x="${w / 2}" y="${h / 2 - 20}" text-anchor="middle" fill="${fg}"
        font-family="Georgia, serif" font-size="96" font-weight="700">${safe(location)}</text>
  <text x="${w / 2}" y="${h / 2 + 50}" text-anchor="middle" fill="rgba(255,255,255,0.55)"
        font-family="Georgia, serif" font-size="34" letter-spacing="6">${safe(country.toUpperCase())}</text>
  <text x="${w / 2}" y="${h - 60}" text-anchor="middle" fill="rgba(255,255,255,0.35)"
        font-family="system-ui, sans-serif" font-size="22" letter-spacing="3">PLACEHOLDER</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function gridDots(w: number, h: number): string {
  const out: string[] = [];
  const step = 40;
  for (let y = 20; y < h; y += step) {
    for (let x = 20; x < w; x += step) {
      out.push(`<circle cx="${x}" cy="${y}" r="2"/>`);
    }
  }
  return out.join("");
}
