import { redirect } from "next/navigation";
import { BrandDNAPage } from "@/components/brand-dna/BrandDNAPage";
import { getAuthContext } from "@/lib/currentUser";

// Brand DNA / Org Settings — owner only. Per operator brief: brand
// defaults are an org-level commitment that drives every member's
// proposals, so the page is a hard owner-only surface. Members
// hitting this URL get redirected to /dashboard with a hint flag
// (the dashboard can show a toast if it wants to). API routes
// already enforce 403 for non-owners; this is the parallel UI gate.

export default async function BrandSettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.organization) redirect("/select-organization");
  if (ctx.role !== "owner") {
    redirect("/dashboard?notice=brand-owner-only");
  }
  return <BrandDNAPage />;
}
