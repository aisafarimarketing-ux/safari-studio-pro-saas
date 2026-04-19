"use client";

import { SignUp } from "@clerk/nextjs";

// Client component — same reasoning as sign-in: avoid the empty-on-first-load
// behaviour that forces a manual refresh after Next.js client-side navigation.
// Organizations are enabled with personal accounts OFF, so after the account
// is created Clerk inserts a TaskChooseOrganization step before redirecting.
// If a user ever lands signed-in without an active org, middleware re-routes
// them to /select-organization.

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef] p-6">
      <SignUp fallbackRedirectUrl="/select-organization" signInUrl="/sign-in" />
    </div>
  );
}
