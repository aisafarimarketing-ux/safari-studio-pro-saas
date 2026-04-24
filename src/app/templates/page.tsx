import type { Metadata } from "next";
import Link from "next/link";
import { listTemplates } from "@/lib/templates";
import { STARTER_LIBRARY } from "@/lib/starterLibrary";
import type { Template } from "@/lib/templates/types";

// ─── /templates ─────────────────────────────────────────────────────────────
//
// Public directory landing. One SSG page that owns the "safari templates"
// search term family and feeds into each individual /templates/[slug] page.
// Grid of cards for the 20 Kenya + Tanzania templates; no filtering yet
// (countries are grouped visually). Each card's hero image comes from the
// first library-matched camp for that template.

export const metadata: Metadata = {
  title: "Safari Itinerary Templates — Kenya & Tanzania | Safari Studio",
  description:
    "Twenty proven East-African safari itineraries — Kenya and Tanzania. Clone any template in seconds, customise freely, send to your clients. Free to preview, $29/month to send.",
  openGraph: {
    title: "Safari Itinerary Templates — Kenya & Tanzania",
    description: "Twenty proven East-Africa safari itinerary starting points. Clone, customise, send.",
    type: "website",
  },
};

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";
const BONE = "#f8f5ef";

export default function TemplatesDirectoryPage() {
  const all = listTemplates();
  const kenya = all.filter((t) => t.countries.includes("Kenya") && !t.countries.includes("Tanzania"));
  const tanzania = all.filter((t) => t.countries.includes("Tanzania") && !t.countries.includes("Kenya"));

  return (
    <div className="min-h-screen" style={{ background: BONE }}>
      <Nav />
      <Hero />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <TemplateSection title="Kenya" count={kenya.length} templates={kenya} />
        <TemplateSection title="Tanzania" count={tanzania.length} templates={tanzania} />
      </main>

      <FooterCTA />
      <Footer />
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden pt-16" style={{ background: FOREST }}>
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative max-w-4xl mx-auto px-6 pt-14 pb-14 text-center">
        <div className="inline-block text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: GOLD }}>
          Templates
        </div>
        <h1
          className="mt-5 text-4xl md:text-5xl font-bold text-white leading-[1.1] tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Twenty proven East-Africa <em className="not-italic" style={{ color: GOLD }}>starting shapes</em>.
        </h1>
        <p className="mt-5 text-[15px] md:text-[16px] text-white/65 max-w-xl mx-auto leading-relaxed">
          Every template is a full proposal — guests, days, camps, pricing,
          practical info. Clone one; then change anything. Reduce days, add
          destinations, swap camps, retune the voice. One template becomes
          your next hundred proposals.
        </p>
      </div>
    </section>
  );
}

// ─── Section of cards ──────────────────────────────────────────────────────

function TemplateSection({
  title,
  count,
  templates,
}: {
  title: string;
  count: number;
  templates: Template[];
}) {
  if (templates.length === 0) return null;
  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-3 mb-5">
        <h2
          className="text-2xl md:text-3xl font-bold tracking-tight text-black/85"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        <div className="text-[11px] uppercase tracking-widest text-black/40 font-semibold">
          {count} templates
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((t) => (
          <TemplateCard key={t.slug} template={t} />
        ))}
      </div>
    </section>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: Template }) {
  // Pull the first library-matched camp's lead image as the card hero.
  // Falls back to a branded placeholder if no day's active tier lands on
  // a starter entry (rare — only happens with specialty templates using
  // destinations outside the starter library's coverage).
  const heroImageUrl = firstLibraryImageFor(template);

  return (
    <Link
      href={`/templates/${template.slug}`}
      className="group relative block rounded-2xl overflow-hidden border bg-white hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)] transition"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      {/* Hero image */}
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "#efece4" }}>
        {heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImageUrl}
            alt={template.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`,
            }}
          >
            <div className="text-[#c9a84c] text-4xl">✦</div>
          </div>
        )}

        {/* Nights + country chips overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <span
            className="text-[10.5px] uppercase tracking-[0.16em] font-semibold px-2 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.92)", color: FOREST }}
          >
            {template.nights} nights
          </span>
          <span
            className="text-[10.5px] uppercase tracking-[0.16em] font-semibold px-2 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.92)", color: "rgba(0,0,0,0.7)" }}
          >
            {template.style}
          </span>
        </div>
        {template.priceFromPerPerson && (
          <div
            className="absolute top-3 right-3 text-[11px] font-bold px-2 py-0.5 rounded"
            style={{ background: GOLD, color: FOREST }}
          >
            from ${template.priceFromPerPerson} / pp
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3
          className="text-[16px] font-bold text-black/85 leading-snug line-clamp-2"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {template.title}
        </h3>
        <p className="mt-1.5 text-[13px] text-black/55 line-clamp-2 leading-relaxed">
          {template.summary}
        </p>
        <div className="mt-3 text-[12px] text-black/45 group-hover:text-[#1b3a2d] transition">
          Open →
        </div>
      </div>
    </Link>
  );
}

function firstLibraryImageFor(template: Template): string | null {
  const activeTier =
    template.style === "Luxury" ? "signature" :
    template.style === "Classic" ? "classic" :
    "premier";
  for (const day of template.days) {
    const name = day.tiers[activeTier]?.libraryName?.trim();
    if (!name) continue;
    const match = STARTER_LIBRARY.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (match) return match.leadImageUrl;
  }
  return null;
}

// ─── Footer CTA ────────────────────────────────────────────────────────────

function FooterCTA() {
  return (
    <section className="py-14 px-6" style={{ background: FOREST_DEEP }}>
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-block text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: GOLD }}>
          Clone and customise
        </div>
        <h2
          className="mt-4 text-3xl md:text-4xl font-bold text-white tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          One template — <em className="not-italic" style={{ color: GOLD }}>a hundred proposals</em>.
        </h2>
        <p className="mt-5 text-white/60 max-w-xl mx-auto text-[15px] leading-relaxed">
          Every template copies into your workspace as a regular proposal. Edit
          anything — dates, destinations, camps, days, prose. What your client
          receives is uniquely theirs.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            Open Studio — free trial
          </Link>
          <Link
            href="/pricing"
            className="px-5 py-3 rounded-xl text-[14px] text-white/75 hover:text-white transition border border-white/15"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Nav / Footer (mirrors the other public pages) ────────────────────────

function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
      style={{ background: "rgba(27,58,45,0.94)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base"
            style={{ background: "rgba(201,168,76,0.18)", color: GOLD }}
          >
            S
          </div>
          <span className="text-white font-semibold text-[16px] tracking-tight">
            Safari Studio
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <Link href="/demo" className="hover:text-white transition">Demo</Link>
          <Link href="/templates" className="text-white">Templates</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden sm:inline-block px-3 py-1.5 text-sm text-white/70 hover:text-white transition"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 rounded-lg text-[14px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            Open Studio
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer
      className="py-10 border-t"
      style={{ background: FOREST_DEEP, borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-white/40">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center font-bold text-sm"
            style={{ background: "rgba(201,168,76,0.15)", color: GOLD }}
          >
            S
          </div>
          <span className="text-white/55 font-medium">Safari Studio</span>
        </div>
        <div className="flex gap-6">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <Link href="/demo" className="hover:text-white/70 transition">Demo</Link>
          <Link href="/templates" className="hover:text-white/70 transition">Templates</Link>
          <Link href="/pricing" className="hover:text-white/70 transition">Pricing</Link>
        </div>
        <div>&copy; {new Date().getFullYear()} Safari Studio · Nairobi</div>
      </div>
    </footer>
  );
}
