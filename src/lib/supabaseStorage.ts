import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client for Storage uploads. Uses the service-role
// key so it bypasses RLS — never import this from a client component.
//
// The two env vars required:
//   NEXT_PUBLIC_SUPABASE_URL        https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY       dashboard → Project Settings → API
//
// If either is missing the upload API route falls back to returning the
// original data URL, so local dev without Supabase keys still works (just
// without the speed + PDF benefits).

const BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "proposal-assets";

let client: SupabaseClient | null = null;
let ensuredBucket = false;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getStorageBucketName(): string {
  return BUCKET;
}

export function getStorageClient(): SupabaseClient | null {
  if (!isStorageConfigured()) return null;
  if (client) return client;
  // Strip any trailing slash — @supabase/supabase-js concatenates paths
  // directly and a stray slash yields "Invalid path specified in request URL".
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/+$/, "");
  client = createClient(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return client;
}

/** Idempotent — first call creates the bucket as public if it doesn't
 *  exist, later calls no-op. Safe to run on every upload. */
export async function ensureBucket(): Promise<void> {
  if (ensuredBucket) return;
  const c = getStorageClient();
  if (!c) return;
  const { data: list, error: listErr } = await c.storage.listBuckets();
  if (listErr) {
    // Non-fatal — upload call will surface its own error.
    console.warn("[storage] listBuckets failed:", listErr.message);
    return;
  }
  if (!list.some((b) => b.name === BUCKET)) {
    const { error: createErr } = await c.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: "10MB",
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      console.warn("[storage] createBucket failed:", createErr.message);
      return;
    }
  }
  ensuredBucket = true;
}

/** Upload a binary blob under a predictable path and return the public URL. */
export async function uploadToBucket(
  path: string,
  data: Buffer | Blob | ArrayBuffer,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  const c = getStorageClient();
  if (!c) return { error: "Storage not configured" };
  await ensureBucket();
  const { error } = await c.storage.from(BUCKET).upload(path, data, {
    contentType,
    upsert: true,
    cacheControl: "31536000", // 1 year — paths include content-hash-ish ids
  });
  if (error) return { error: error.message };
  const { data: pub } = c.storage.from(BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl };
}
