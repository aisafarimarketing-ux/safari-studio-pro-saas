import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { BuiltFor } from "@/components/marketing/BuiltFor";
import { Comparison } from "@/components/marketing/Comparison";
import { FourAnswers } from "@/components/marketing/FourAnswers";
import { Pricing } from "@/components/marketing/Pricing";
import { CTA } from "@/components/marketing/CTA";
import { Footer } from "@/components/marketing/Footer";
import { BG, INK, SANS } from "@/components/marketing/tokens";

// ─── Landing page ────────────────────────────────────────────────────────────
//
// Public marketing surface. Sections live as modular components in
// src/components/marketing/* — each owning its own copy + visuals.
// Top-down order: Navbar · Hero (dark, dashboard mock right) ·
// BuiltFor (light positioning strip) · Comparison (pain ↔ solution
// cards) · FourAnswers (4 product pillars) · Pricing (dark, 3 tiers)
// · CTA (dark, "Stop guessing. Start closing.") · Footer.
//
// Truth rules (load-bearing):
//   1. The strip under the hero positions Safari Studio against
//      categories of operators. We never imply endorsement we
//      don't have, no fabricated logos.
//   2. The "What operators want" grid (FourAnswers) is product-proof
//      copy keyed off operator needs — not testimonials, not fake
//      reviews, no fabricated names / star ratings / quotes.

export const metadata = {
  title: "Safari Studio — Close more safaris, faster",
  description:
    "The command center for safari operators. Know when clients are ready to book, follow up at the right moment, and close trips with personalized proposals.",
};

export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: INK, fontFamily: SANS }}
    >
      <Navbar />
      <Hero />
      <BuiltFor />
      <Comparison />
      <FourAnswers />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
