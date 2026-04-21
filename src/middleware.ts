import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/studio(.*)",
  "/proposals(.*)",
  "/properties(.*)",
  "/settings(.*)",
  "/admin(.*)",
  "/api/ai(.*)",
  "/api/proposals(.*)",
  "/api/properties(.*)",
  "/api/locations(.*)",
  "/api/property-tags(.*)",
  "/api/brand-dna(.*)",
  "/api/media(.*)",
  "/api/admin(.*)",
  "/api/workspace(.*)",
  // /api/geocode is intentionally public — the share view (/p/[id])
  // renders its own map for unauthenticated guests and needs to look up
  // destination coordinates. Thin proxy over Nominatim, in-process cache.
  "/api/pdf(.*)",
]);

// Routes that a signed-in user without an active organization may still visit
// (the org-selection flow itself, the clerk auth pages, etc.).
const isOrgAgnosticRoute = createRouteMatcher([
  "/select-organization(.*)",
  "/account-suspended(.*)",
  "/admin(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/public(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  // Only run auth.protect() on page routes. Clerk's protect() returns a
  // 404 (not 401) for protected API routes when the session can't be
  // verified — which is opaque to the client and eats the real error.
  // Every /api/* route already calls getAuthContext() and returns a
  // proper 401/402/403/409, so letting them self-protect gives us
  // debuggable errors and matches what the client autosave / fetch
  // helpers already handle.
  if (!isApi && isProtectedRoute(req)) await auth.protect();

  const { userId, orgId } = await auth();
  // Signed-in but no active organization → force them through the picker
  // before they can reach any app surface that depends on tenant scope.
  // API routes don't redirect — they return 409 (handled by the route).
  if (!isApi && userId && !orgId && !isOrgAgnosticRoute(req)) {
    const url = new URL("/select-organization", req.url);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
