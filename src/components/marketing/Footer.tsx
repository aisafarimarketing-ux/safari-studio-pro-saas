/* eslint-disable @next/next/no-html-link-for-pages */
import Link from "next/link";
import { GREEN, HERO_TOP } from "./tokens";

// Dark footer matching the hero/CTA gradient. Logo + Nairobi locale
// on the left; nav links centre-right; copyright far right. Single
// row on lg+, wraps gracefully below.

export function Footer() {
  return (
    <footer
      className="py-12"
      style={{
        background: HERO_TOP,
        color: "rgba(255,255,255,0.55)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[13px]"
            style={{ background: GREEN, color: "#fff" }}
            aria-hidden
          >
            S
          </div>
          <span className="text-white font-medium text-[14px]">
            Safari Studio
          </span>
          <span className="text-[13px] ml-2">· Nairobi</span>
        </div>

        <div className="flex items-center gap-6 text-[13px]">
          <Link href="/demo" className="hover:text-white transition">
            Live demo
          </Link>
          <Link href="/pricing" className="hover:text-white transition">
            Pricing
          </Link>
          <a href="/sign-up" className="hover:text-white transition">
            Open Studio
          </a>
        </div>

        <div className="text-[12px]">
          &copy; {new Date().getFullYear()} Safari Studio
        </div>
      </div>
    </footer>
  );
}
