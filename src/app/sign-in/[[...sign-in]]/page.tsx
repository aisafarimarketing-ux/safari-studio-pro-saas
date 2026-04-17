import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ef] p-6">
      <SignIn />
    </div>
  );
}
