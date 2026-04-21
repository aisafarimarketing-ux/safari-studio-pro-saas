"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useHeartbeat } from "./useHeartbeat";

// Thin wrapper that drives the presence heartbeat from the current route.
// Mount once in the authenticated layout — every signed-in page will
// contribute a "user is here, currently at X" signal for the Team view.
//
// Route → human-readable label mapping lives here so when we add more
// surfaces we do it in one place. Unknown routes emit the raw path.

const ROUTE_LABELS: { pattern: RegExp; view: string; action: string }[] = [
  { pattern: /^\/studio$/,                   view: "studio",     action: "in workspace" },
  { pattern: /^\/studio\/([^/]+)/,           view: "proposal",   action: "editing proposal" },
  { pattern: /^\/requests$/,                 view: "requests",   action: "reviewing inbox" },
  { pattern: /^\/requests\/([^/]+)/,         view: "request",    action: "reviewing request" },
  { pattern: /^\/properties/,                view: "library",    action: "in library" },
  { pattern: /^\/proposals/,                 view: "proposals",  action: "reviewing proposals" },
  { pattern: /^\/team/,                      view: "team",       action: "viewing team" },
  { pattern: /^\/settings/,                  view: "settings",   action: "in settings" },
  { pattern: /^\/brand-dna/,                 view: "brand-dna",  action: "editing Brand DNA" },
];

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname() ?? "";
  const match = ROUTE_LABELS.find((r) => r.pattern.test(pathname));

  // Only beat when Clerk has confirmed a signed-in user. Avoids chatter on
  // the marketing page and sign-in screens. An unsigned hit would hit 204
  // anyway but this saves the round-trip.
  const currentView = isSignedIn && isLoaded ? (match?.view ?? pathname) : null;
  const currentAction = isSignedIn && isLoaded ? (match?.action ?? null) : null;

  useHeartbeat({ currentView, currentAction });

  return <>{children}</>;
}
