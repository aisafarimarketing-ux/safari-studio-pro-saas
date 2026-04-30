import { redirect } from "next/navigation";

// /settings has no UI of its own — the sidebar's "Settings" link
// points here as the umbrella entry point and we bounce the operator
// to the most-used sub-page (Profile). Without this server-side
// redirect, Next.js's link prefetcher logged a 404 every time the
// sidebar mounted because no page.tsx existed at this path.
//
// If a real Settings hub UI is added later, replace this redirect
// with the hub component.

export default function SettingsIndexPage() {
  redirect("/settings/profile");
}
