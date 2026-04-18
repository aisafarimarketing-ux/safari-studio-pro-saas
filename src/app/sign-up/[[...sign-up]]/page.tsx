import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef] p-6">
      {/* Organizations are enabled with personal accounts OFF, so after the
          account is created Clerk inserts a TaskChooseOrganization step
          before redirecting. If a user ever lands signed-in without an
          active org, middleware re-routes them to /select-organization. */}
      <SignUp fallbackRedirectUrl="/select-organization" signInUrl="/sign-in" />
    </div>
  );
}
