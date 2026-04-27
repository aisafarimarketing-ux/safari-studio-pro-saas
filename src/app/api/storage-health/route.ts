import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/currentUser";
import {
  isStorageConfigured,
  getStorageBucketName,
  getStorageClient,
} from "@/lib/supabaseStorage";

// ─── GET /api/storage-health ───────────────────────────────────────────────
//
// Probes the Supabase Storage configuration end-to-end and reports
// what's wrong if anything is. Auth-only — operators / admins. Useful
// when uploads have been silently falling back to data URLs and the
// only visible symptom is the autosave size error.
//
// Response shape (always 200):
//   {
//     ok: boolean,
//     configured: boolean,        // env vars present
//     bucketName: string,
//     bucketExists: boolean,      // listBuckets succeeded + matched
//     uploadProbeOk: boolean,     // tiny test write + delete
//     error: string | null,       // first failure encountered
//     env: {
//       hasUrl: boolean,
//       hasServiceRoleKey: boolean,
//       hasBucketOverride: boolean,
//     }
//   }

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const env = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    hasBucketOverride: !!process.env.SUPABASE_STORAGE_BUCKET?.trim(),
  };
  const bucketName = getStorageBucketName();
  const configured = isStorageConfigured();

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      bucketName,
      bucketExists: false,
      uploadProbeOk: false,
      error: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
      env,
    });
  }

  const client = getStorageClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: true,
      bucketName,
      bucketExists: false,
      uploadProbeOk: false,
      error: "Failed to construct Supabase client (URL + key shape probably wrong).",
      env,
    });
  }

  // List buckets — verifies URL + service role key are valid for this project.
  let bucketExists = false;
  let firstError: string | null = null;
  try {
    const { data: list, error: listErr } = await client.storage.listBuckets();
    if (listErr) {
      firstError = `listBuckets failed: ${listErr.message}`;
    } else {
      bucketExists = list.some((b) => b.name === bucketName);
      if (!bucketExists) {
        firstError = `Bucket "${bucketName}" does not exist in this Supabase project. Check Storage → Buckets in the dashboard, or create it.`;
      }
    }
  } catch (err) {
    firstError = `listBuckets threw: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (!bucketExists) {
    return NextResponse.json({
      ok: false,
      configured: true,
      bucketName,
      bucketExists: false,
      uploadProbeOk: false,
      error: firstError,
      env,
    });
  }

  // Upload probe — write a tiny text blob, delete it, confirm the round-
  // trip works. This catches RLS / policy / quota issues that listBuckets
  // alone wouldn't reveal.
  let uploadProbeOk = false;
  try {
    const probePath = `_health/probe-${Date.now()}.txt`;
    const probeBody = `safari-studio storage health probe ${new Date().toISOString()}`;
    const { error: upErr } = await client.storage
      .from(bucketName)
      .upload(probePath, probeBody, {
        contentType: "text/plain",
        upsert: true,
      });
    if (upErr) {
      firstError = `upload probe failed: ${upErr.message}`;
    } else {
      uploadProbeOk = true;
      // Best-effort cleanup. Probe failures here aren't the operator's
      // problem — just leak silently if remove fails.
      await client.storage.from(bucketName).remove([probePath]).catch(() => {});
    }
  } catch (err) {
    firstError = `upload probe threw: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    ok: uploadProbeOk,
    configured: true,
    bucketName,
    bucketExists: true,
    uploadProbeOk,
    error: uploadProbeOk ? null : firstError,
    env,
  });
}
