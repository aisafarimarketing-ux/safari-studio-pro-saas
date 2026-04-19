"use client";

import { SignIn } from "@clerk/nextjs";

// Client component so Clerk hydrates reliably on first visit. Previously
// this was a server component, which sometimes rendered empty on
// client-side navigations from the landing page — the user had to refresh
// to see the sign-in form.

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef] p-6">
      <SignIn fallbackRedirectUrl="/dashboard" signUpUrl="/sign-up" />
    </div>
  );
}
