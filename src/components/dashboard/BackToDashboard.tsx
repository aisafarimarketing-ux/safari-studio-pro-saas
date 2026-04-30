"use client";

import Link from "next/link";

// ─── BackToDashboard ─────────────────────────────────────────────────────
//
// Tiny reusable "← Back to dashboard" link used at the top of every
// section page (Proposals, Properties, Reservations, Requests, etc.)
// so the operator can always find their way back to the main
// dashboard with one click. Keeps the navigation discoverable; the
// sidebar already exposes everything but mobile / narrow viewports
// often hide it.

export function BackToDashboard({
  className = "",
  href = "/dashboard",
  label = "Back to dashboard",
}: {
  className?: string;
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium text-black/55 hover:text-black/85 transition ${className}`}
    >
      <span aria-hidden className="text-[14px] leading-none">
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}
