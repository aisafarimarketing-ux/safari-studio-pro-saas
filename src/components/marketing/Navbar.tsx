/* eslint-disable @next/next/no-html-link-for-pages */
// Native <a> tags for /sign-in and /sign-up are intentional — Clerk's
// widget mounts cleanly on a fresh document load. Don't replace these
// with <Link> without verifying the auth flow in incognito.

import Link from "next/link";
import { CARD_BORDER, GREEN, INK, INK_2 } from "./tokens";

// Sticky top nav: logo (left) · Product / Why / Pricing / Resources
// (centre) · Log in + green Book-a-demo CTA (right). Background uses
// 85% page-bg + backdrop-blur so headlines below stay legible as the
// user scrolls.

export function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background: "rgba(247,245,240,0.85)",
        borderBottom: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
            style={{ background: GREEN, color: "#fff" }}
            aria-hidden
          >
            S
          </div>
          <span
            className="font-semibold text-[15px]"
            style={{ color: INK, letterSpacing: "-0.005em" }}
          >
            Safari Studio
          </span>
        </Link>

        <div
          className="hidden md:flex items-center gap-8 text-[14px]"
          style={{ color: INK_2 }}
        >
          <a href="#product" className="hover:text-black transition">Product</a>
          <a href="#why" className="hover:text-black transition">Why</a>
          <a href="#pricing" className="hover:text-black transition">Pricing</a>
          <Link href="/demo" className="hover:text-black transition">Resources</Link>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/sign-in"
            className="hidden sm:inline-flex items-center justify-center px-3 h-9 text-[13.5px] font-medium transition"
            style={{ color: INK_2 }}
          >
            Log in
          </a>
          <a
            href="/sign-up"
            className="inline-flex items-center justify-center px-4 h-9 rounded-lg text-[13.5px] font-semibold transition active:scale-[0.97]"
            style={{ background: GREEN, color: "#fff" }}
          >
            Book a demo
          </a>
        </div>
      </div>
    </nav>
  );
}
