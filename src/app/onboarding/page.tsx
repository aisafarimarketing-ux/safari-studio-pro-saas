import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/currentUser";

// ─── /onboarding ────────────────────────────────────────────────────────
//
// Hard-gate intake form for any member whose OrgMembership record
// has onboardedAt = null (newly invited members landing on the app
// for the first time). Collects:
//   • Profile photo
//   • Signature
//   • Display name
//   • Role title
//   • WhatsApp number
//   • Email (read-only — Clerk owns the canonical email)
//
// On submit, PATCH /api/team/[myUserId] writes every field plus
// markOnboarded:true so the membership's onboardedAt is stamped.
// The client then redirects to /dashboard.
//
// Server check up front: if the user is already onboarded, redirect
// straight to /dashboard so the page can't be revisited.

export default async function OnboardingPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.organization) redirect("/select-organization");
  if (ctx.membership?.onboardedAt) redirect("/dashboard");

  return (
    <OnboardingForm
      myUserId={ctx.user.id}
      initial={{
        name: ctx.user.name ?? "",
        email: ctx.user.email ?? "",
        roleTitle: ctx.membership?.roleTitle ?? "",
        whatsapp: ctx.membership?.whatsapp ?? "",
        photoUrl: ctx.membership?.profilePhotoUrl ?? null,
        signatureUrl: ctx.membership?.signatureUrl ?? null,
      }}
      orgName={ctx.organization.name ?? ""}
    />
  );
}
