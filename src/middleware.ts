import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/studio(.*)",
  "/proposals(.*)",
  "/settings(.*)",
  "/api/ai(.*)",
  "/api/proposals(.*)",
]);

// Routes that a signed-in user without an active organization may still visit
// (the org-selection flow itself, the clerk auth pages, etc.).
const isOrgAgnosticRoute = createRouteMatcher([
  "/select-organization(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/public(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();

  const { userId, orgId } = await auth();
  // Signed-in but no active organization → force them through the picker
  // before they can reach any app surface that depends on tenant scope.
  if (userId && !orgId && !isOrgAgnosticRoute(req)) {
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
