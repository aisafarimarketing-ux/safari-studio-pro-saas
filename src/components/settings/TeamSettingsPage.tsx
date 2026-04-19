"use client";

import Link from "next/link";
import { OrganizationProfile, useOrganization } from "@clerk/nextjs";
import { AppHeader } from "@/components/properties/AppHeader";

// Team management surface. Reuses Clerk's full-featured
// <OrganizationProfile /> component which already handles:
//   - Members list with roles
//   - Invite flow (email, role selection, resend, revoke)
//   - Pending invitations
//   - Member removal
//
// We just host it inside the app's visual shell so it doesn't feel like
// jumping out to a third-party settings page.

export function TeamSettingsPage() {
  const { organization, isLoaded } = useOrganization();

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-6 py-10 md:py-12">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-label ed-label text-[#1b3a2d]">Settings</div>
            <h1 className="mt-2 text-h1 font-bold tracking-tight text-black/85" style={{ fontFamily: "'Playfair Display', serif" }}>
              Team &amp; seats
            </h1>
            <p className="mt-2 text-body text-black/55 max-w-xl">
              Invite teammates, assign roles, and manage pending invitations.
              Operator tier includes up to 5 seats; talk to us if you need more.
            </p>
          </div>
          <Link
            href="/settings/brand"
            className="text-small text-black/45 hover:text-[#1b3a2d] transition"
          >
            Brand DNA →
          </Link>
        </div>

        {!isLoaded ? (
          <div className="h-64 bg-white rounded-2xl border border-black/8 animate-pulse" />
        ) : !organization ? (
          <div className="rounded-2xl border border-[#b34334]/30 bg-[#b34334]/5 p-6 text-[#b34334]">
            <div className="font-semibold">No active organization</div>
            <p className="text-sm mt-1">
              <Link href="/select-organization" className="underline">
                Create or join a workspace
              </Link>{" "}
              before inviting teammates.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden bg-white border border-black/8 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
            <OrganizationProfile
              routing="hash"
              appearance={{
                elements: {
                  rootBox: { width: "100%" },
                  cardBox: { width: "100%", boxShadow: "none" },
                  navbar: { background: "#f7f4ee" },
                  organizationProfilePage: { padding: "24px" },
                },
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
