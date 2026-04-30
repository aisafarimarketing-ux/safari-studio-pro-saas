import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/studio(.*)",
  "/proposals(.*)",
  "/properties(.*)",
  "/import(.*)",
  "/reservations(.*)",
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

  // Detect Next.js React Server Component prefetch requests. The browser
  // fires these on Link hover / viewport-entry to warm the route. When
  // the session is expired AND the prefetched route is protected,
  // Clerk's auth.protect() redirects to a cross-origin sign-in URL —
  // and the browser blocks the redirect with a CORS error
  // ("Response to preflight request doesn't pass access control check"),
  // flooding the operator's console with red.
  //
  // Identify these by the RSC header Next.js sends OR the ?_rsc=...
  // query param it appends. For these requests we'd rather return a
  // clean 401 (which the prefetcher silently discards) than fire a
  // cross-origin redirect.
  const isRscPrefetch =
    req.headers.get("RSC") === "1" ||
    req.headers.get("Next-Router-Prefetch") === "1" ||
    req.nextUrl.searchParams.has("_rsc");

  // Only run auth.protect() on page routes. Clerk's protect() returns a
  // 404 (not 401) for protected API routes when the session can't be
  // verified — which is opaque to the client and eats the real error.
  // Every /api/* route already calls getAuthContext() and returns a
  // proper 401/402/403/409, so letting them self-protect gives us
  // debuggable errors and matches what the client autosave / fetch
  // helpers already handle.
  if (!isApi && isProtectedRoute(req)) {
    if (isRscPrefetch) {
      // Short-circuit prefetches with a plain 401. The Next.js
      // prefetcher swallows non-2xx silently — the user's actual
      // navigation will then hit Clerk's redirect normally.
      const { userId } = await auth();
      if (!userId) {
        return new NextResponse(null, { status: 401 });
      }
    } else {
      await auth.protect();
    }
  }

  const { userId, orgId } = await auth();
  // Signed-in but no active organization → force them through the picker
  // before they can reach any app surface that depends on tenant scope.
  // API routes don't redirect — they return 409 (handled by the route).
  // RSC prefetches also short-circuit with 401 here so the prefetcher
  // silently fails instead of triggering a cross-origin redirect to
  // /select-organization that the browser would mishandle the same way.
  if (!isApi && userId && !orgId && !isOrgAgnosticRoute(req)) {
    if (isRscPrefetch) {
      return new NextResponse(null, { status: 401 });
    }
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
