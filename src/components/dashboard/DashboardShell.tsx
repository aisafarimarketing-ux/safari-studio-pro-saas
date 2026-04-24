"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, SignOutButton, UserButton, useUser } from "@clerk/nextjs";

// ─── Dashboard shell ───────────────────────────────────────────────────────
//
// Three-column layout for /dashboard: persistent left navigation, flexible
// main content, optional right rail. Responsive — left collapses to icons
// on tablet, right rail slides below main on narrow screens.
//
// The sidebar is dashboard-specific for now. Other authed surfaces still
// run AppHeader's top-nav. Once this lands we can migrate each surface
// as we touch it.

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Work",
    items: [
      { href: "/dashboard", label: "Overview",     glyph: "◎", match: (p) => p === "/dashboard" },
      { href: "/requests",  label: "Requests",     glyph: "✉", match: (p) => p.startsWith("/requests") },
      { href: "/proposals", label: "Proposals",    glyph: "❯", match: (p) => p.startsWith("/proposals") },
      { href: "/reservations", label: "Reservations", glyph: "⌂", match: (p) => p.startsWith("/reservations") },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/properties", label: "Properties", glyph: "▦", match: (p) => p.startsWith("/properties") },
      { href: "/templates",  label: "Templates",  glyph: "✦", match: (p) => p.startsWith("/templates") },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/analytics", label: "Analytics", glyph: "◐", match: (p) => p.startsWith("/analytics") },
      { href: "/team",      label: "Team",      glyph: "◇", match: (p) => p === "/team" || p.startsWith("/team/") },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/profile", label: "Profile",   glyph: "◈", match: (p) => p.startsWith("/settings/profile") },
      { href: "/settings/brand",   label: "Brand DNA", glyph: "◆", match: (p) => p.startsWith("/settings/brand") },
      { href: "/settings/billing", label: "Billing",   glyph: "$", match: (p) => p.startsWith("/settings/billing") },
      { href: "/settings/team",    label: "Seats",     glyph: "◦", match: (p) => p === "/settings/team" },
    ],
  },
];

type NavItem = {
  href: string;
  label: string;
  glyph: string;
  match: (pathname: string) => boolean;
};

export function DashboardShell({
  main,
  rightRail,
}: {
  main: React.ReactNode;
  rightRail?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex" style={{ background: "#faf8f3" }}>
      <LeftSidebar />
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-4xl mx-auto px-6 py-8 lg:py-10">
            {main}
          </div>
        </main>
        {rightRail && (
          <aside className="w-full lg:w-[320px] shrink-0 px-6 pb-10 lg:py-10 lg:pr-8 lg:pl-2">
            {rightRail}
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Left sidebar ──────────────────────────────────────────────────────────

function LeftSidebar() {
  return (
    <nav
      className="shrink-0 hidden md:flex md:w-[224px] lg:w-[240px] flex-col border-r bg-white"
      style={{ borderColor: "rgba(0,0,0,0.06)" }}
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base"
            style={{ background: "rgba(201,168,76,0.15)", color: "#c9a84c" }}
          >
            S
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-black/85">
            Safari Studio
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.label} group={group} />
        ))}
      </div>

      <div className="border-t px-3 py-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <UserCard />
      </div>
    </nav>
  );
}

function NavGroup({ group }: { group: (typeof NAV_GROUPS)[number] }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="mb-3 px-3">
      <div className="px-2 py-1.5 text-[9.5px] uppercase tracking-[0.22em] font-semibold text-black/35">
        {group.label}
      </div>
      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13.5px] transition ${
                  active
                    ? "bg-[#1b3a2d] text-white"
                    : "text-black/70 hover:bg-black/[0.04]"
                }`}
              >
                <span
                  className={`w-5 text-center text-[13px] ${active ? "text-[#c9a84c]" : "text-black/40"}`}
                  aria-hidden
                >
                  {item.glyph}
                </span>
                <span className="flex-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UserCard() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) {
    return <div className="h-12 rounded-lg animate-pulse bg-black/5" />;
  }
  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className="block px-3 py-2.5 rounded-lg text-[13px] text-black/70 border hover:bg-black/5 transition"
        style={{ borderColor: "rgba(0,0,0,0.1)" }}
      >
        Sign in →
      </Link>
    );
  }
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "You";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = (user?.firstName?.[0] ?? email[0] ?? "·").toUpperCase();
  return (
    <div>
      <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-black/[0.03] transition">
        <div className="relative w-9 h-9 shrink-0">
          <SignOutButton redirectUrl="/">
            <button
              type="button"
              className="absolute inset-0 rounded-full flex items-center justify-center text-[12px] font-semibold text-white bg-[#1b3a2d] hover:bg-[#2d5a40] transition"
              title={`Sign out (${email})`}
              aria-label="Sign out"
            >
              {initials}
            </button>
          </SignOutButton>
          <div className="absolute inset-0 pointer-events-none">
            <UserButton
              appearance={{
                elements: {
                  rootBox: { width: "2.25rem", height: "2.25rem", pointerEvents: "auto" },
                  avatarBox: { width: "2.25rem", height: "2.25rem" },
                  userButtonTrigger: { pointerEvents: "auto" },
                  userButtonPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
                },
              }}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-black/85 truncate">{name}</div>
          <div className="text-[11px] text-black/45 truncate">{email}</div>
        </div>
      </div>
      <div className="mt-2 px-1">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
          afterLeaveOrganizationUrl="/select-organization"
          appearance={{
            elements: {
              rootBox: { width: "100%" },
              organizationSwitcherTrigger: {
                width: "100%",
                padding: "6px 10px",
                borderRadius: "0.5rem",
                fontSize: "12.5px",
                justifyContent: "flex-start",
              },
              organizationSwitcherPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
            },
          }}
        />
      </div>
    </div>
  );
}
