"use client";

import Link from "next/link";
import {
  OrganizationSwitcher,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

// Shared header for the property pages — matches the patterns used on
// /proposals and /settings/brand. Pulled into its own file because it's
// repeated on the list + editor pages.

export function AppHeader({
  middleSlot,
}: {
  middleSlot?: React.ReactNode;
}) {
  return (
    <header className="h-14 border-b border-black/10 bg-white flex items-center justify-between px-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/proposals" className="flex items-center gap-2 group shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c9a84c] font-bold text-base"
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            S
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-black/80 group-hover:text-black transition">
            Safari Studio
          </span>
        </Link>
        <Nav />
        {middleSlot}
      </div>
      <div className="flex items-center gap-3">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/proposals"
          afterCreateOrganizationUrl="/proposals"
          afterLeaveOrganizationUrl="/select-organization"
          appearance={{
            elements: {
              organizationSwitcherTrigger: {
                padding: "4px 10px",
                borderRadius: "0.5rem",
                fontSize: "13px",
                maxWidth: "220px",
              },
              organizationSwitcherPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
              organizationSwitcherPopoverRootBox: { zIndex: 9999 },
            },
          }}
        />
        <UserMenu />
      </div>
    </header>
  );
}

function Nav() {
  return (
    <nav className="flex items-center gap-1 ml-2">
      <NavLink href="/proposals">Proposals</NavLink>
      <NavLink href="/properties">Properties</NavLink>
      <NavLink href="/settings/brand">Brand DNA</NavLink>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1 rounded-md text-[13px] text-black/55 hover:text-black/85 hover:bg-black/[0.04] transition"
    >
      {children}
    </Link>
  );
}

function UserMenu() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <div className="w-8 h-8 rounded-full bg-black/10 animate-pulse" />;
  if (!isSignedIn)
    return (
      <Link
        href="/sign-in"
        className="px-3 py-1.5 text-sm rounded-lg border border-black/12 text-black/70 hover:bg-black/5 transition"
      >
        Sign in
      </Link>
    );
  const initials = (
    (user?.firstName?.[0] ?? "") +
    (user?.lastName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "")
  ).toUpperCase();
  return (
    <div className="relative w-8 h-8">
      <SignOutButton redirectUrl="/">
        <button
          type="button"
          className="absolute inset-0 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-[#1b3a2d] hover:bg-[#2d5a40] transition"
          title="Sign out"
          aria-label="Sign out"
        >
          {initials || "•"}
        </button>
      </SignOutButton>
      <div className="absolute inset-0">
        <UserButton
          appearance={{
            elements: {
              rootBox: { width: "2rem", height: "2rem" },
              avatarBox: { width: "2rem", height: "2rem" },
              userButtonPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
              userButtonPopoverRootBox: { zIndex: 9999 },
            },
          }}
        />
      </div>
    </div>
  );
}
