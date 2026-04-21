"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  OrganizationSwitcher,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

// Shared chrome for the authenticated app surface — Dashboard, Proposals,
// Properties, Brand DNA. The active route is highlighted via the URL.
//
// (Lives under /components/properties/ for historical reasons; pulled
// across pages without further moves to keep import paths stable.)

const NAV: { href: string; label: string; matches: (pathname: string) => boolean }[] = [
  { href: "/dashboard", label: "Overview", matches: (p) => p === "/dashboard" },
  { href: "/requests", label: "Requests", matches: (p) => p.startsWith("/requests") },
  { href: "/proposals", label: "Proposals", matches: (p) => p.startsWith("/proposals") },
  { href: "/properties", label: "Properties", matches: (p) => p.startsWith("/properties") },
  { href: "/settings/brand", label: "Brand DNA", matches: (p) => p.startsWith("/settings/brand") },
  { href: "/team", label: "Team", matches: (p) => p === "/team" || p.startsWith("/team/") },
];

export function AppHeader({
  middleSlot,
}: {
  middleSlot?: React.ReactNode;
}) {
  return (
    <header className="h-14 border-b border-black/10 bg-white flex items-center justify-between px-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-2 group shrink-0">
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
          afterSelectOrganizationUrl="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
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
  const pathname = usePathname() || "";
  return (
    <nav className="flex items-center gap-1 ml-2">
      {NAV.map((item) => {
        const active = item.matches(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-2.5 py-1 rounded-md text-[13px] transition ${
              active
                ? "text-[#1b3a2d] font-medium bg-[#1b3a2d]/[0.07]"
                : "text-black/55 hover:text-black/85 hover:bg-black/[0.04]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
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
