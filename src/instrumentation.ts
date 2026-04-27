// Next 16 instrumentation hook — fires once when the server boots.
// We use it as a stdout heartbeat so Railway's runtime/deploy logs
// can confirm the Node process actually started and which env vars
// it has. Without this it's hard to tell whether "service unavailable"
// at the healthcheck stage is "container never started" or "container
// is up but not binding to PORT".

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const sha = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown";
  const port = process.env.PORT ?? "(unset, next start will default to 3000)";
  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasClerk = Boolean(process.env.CLERK_SECRET_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Single-line log so it shows up clearly in Railway's deploy logs
  // even when other startup output is interleaved.
  console.log(
    `[boot] safari-studio-pro starting · sha=${sha} · port=${port} · ` +
      `db=${hasDb ? "yes" : "MISSING"} · clerk=${hasClerk ? "yes" : "MISSING"} · ` +
      `anthropic=${hasAnthropic ? "yes" : "MISSING"} · ` +
      `supabase=${hasSupabaseUrl && hasSupabaseKey ? "yes" : "MISSING"}`,
  );
}
