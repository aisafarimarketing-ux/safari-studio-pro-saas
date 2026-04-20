import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import { nanoid } from "@/lib/nanoid";
import {
  isStorageConfigured,
  uploadToBucket,
} from "@/lib/supabaseStorage";

// POST /api/upload-image — multipart/form-data { file }
//
// Auth-scoped to the signed-in user's active organization. On success
// returns { url: "<public supabase URL>" }. If Supabase Storage isn't
// configured (env vars missing), returns 503 and the client should fall
// back to its data-URL path so dev flow doesn't break.
//
// Path scheme: <orgId>/<yyyy-mm>/<nanoid>.<ext>
//   - organises by org for easy audit / retention
//   - month prefix keeps any given folder small
//   - nanoid is enough entropy to avoid collisions without hashing

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.organization) {
    return NextResponse.json({ error: "No active organization" }, { status: 409 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Supabase Storage not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — max ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB` },
      { status: 413 },
    );
  }

  const contentType = file.type || "application/octet-stream";
  const ext = ALLOWED[contentType];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported file type: ${contentType}` },
      { status: 415 },
    );
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const path = `${ctx.organization.id}/${month}/${nanoid()}.${ext}`;

  const ab = await file.arrayBuffer();
  const result = await uploadToBucket(path, ab, contentType);
  if ("error" in result) {
    console.error("[upload-image] upload failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ url: result.url, path });
}
