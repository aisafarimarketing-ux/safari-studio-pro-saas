import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "prisma/config";

// Load DATABASE_URL from .env.local (overrides .env) — Next.js convention.
for (const name of [".env", ".env.local"]) {
  const file = path.join(__dirname, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

// `prisma generate` doesn't need a reachable DB — just a syntactically valid URL.
// At runtime, migrations/db-push will fail loudly if DATABASE_URL is actually missing.
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: DATABASE_URL,
  },
});
