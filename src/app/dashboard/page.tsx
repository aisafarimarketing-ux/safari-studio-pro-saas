import { redirect } from "next/navigation";
import { CommandCenter } from "@/components/dashboard/CommandCenter";
import { getAuthContext } from "@/lib/currentUser";

// /dashboard is the canonical landing route after sign-in. We do a
// server-side onboarding check here: if the member hasn't completed
// the intake form (onboardedAt = null), redirect to /onboarding
// before the dashboard renders. This is the hard gate per operator
// brief — members can't reach the dashboard until photo / signature
// / WhatsApp are set on their membership record.

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.organization) redirect("/select-organization");
  if (!ctx.membership?.onboardedAt) redirect("/onboarding");
  return <CommandCenter />;
}
