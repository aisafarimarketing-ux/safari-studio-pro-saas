import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 doesn't auto-load .env files for the config.
// Load DATABASE_URL from .env.local or .env at project root.
for (const name of [".env.local", ".env"]) {
  const file = path.join(__dirname, name);
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
    break;
  }
}

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
