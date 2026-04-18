import Link from "next/link";

// ─── Pricing page ───────────────────────────────────────────────────────────
//
// Public marketing page. Two tiers, no free plan. CTAs route to /sign-up;
// payment wiring (Stripe / Paddle) is a future commit. Visual language
// matches the landing page — same forest/gold palette, same Playfair Display
// in editorial moments, same calm-premium tone.

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";
const BONE = "#f8f5ef";
const BONE_2 = "#f3f0ea";

export const metadata = {
  title: "Pricing — Safari Studio",
  description: "Two simple tiers. No free plan. Close one safari and Safari Studio pays for itself.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen text-[#1a1a1a]" style={{ background: BONE }}>
      <Nav />
      <Hero />
      <Plans />
      <Comparison />
      <ValuePillars />
      <FAQ />
      <Footer />
    </div>
  );
}

// ─── Nav ────────────────────────────────────────────────────────────────────

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
          <Link href="/#how" className="hover:text-white transition">How it works</Link>
          <Link href="/#different" className="hover:text-white transition">Why it&apos;s different</Link>
          <Link href="/pricing" className="text-white">Pricing</Link>
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

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-16 relative overflow-hidden" style={{ background: FOREST }}>
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, transparent, ${BONE})` }}
      />
      <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-32 text-center">
        <div
          className="inline-block text-[11px] uppercase tracking-[0.24em] font-semibold"
          style={{ color: GOLD }}
        >
          Pricing
        </div>
        <h1
          className="mt-6 text-5xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Create proposals
          <br />
          clients <em className="not-italic" style={{ color: GOLD }}>say yes to.</em>
        </h1>
        <p className="mt-6 text-[16px] md:text-[17px] text-white/60 max-w-xl mx-auto leading-relaxed">
          Two simple tiers. No free plan. Close one safari and Safari Studio
          pays for itself for the year.
        </p>
      </div>
    </section>
  );
}

// ─── Plans ─────────────────────────────────────────────────────────────────

const EXPLORER_FEATURES = [
  "Up to 5 proposals / month",
  "Property library",
  "AI generation (basic)",
  "Web view sharing",
  "PDF export",
];

const OPERATOR_FEATURES = [
  "Unlimited proposals",
  "Full property system",
  "Brand DNA — full tone control",
  "Priority AI",
  "Advanced exports",
  "Priority support",
];

function Plans() {
  return (
    <section className="-mt-20 pb-20" style={{ background: BONE }}>
      <div className="relative max-w-4xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PlanCard
            tier="Explorer"
            price="$49"
            cadence="/ month"
            tagline="For solo operators sending proposals weekly."
            features={EXPLORER_FEATURES}
            cta="Start Explorer"
            featured={false}
          />
          <PlanCard
            tier="Operator"
            price="$99"
            cadence="/ month"
            tagline="For tour operators, DMCs, and lodges who sell every day."
            features={OPERATOR_FEATURES}
            cta="Start Operator"
            featured
          />
        </div>
        <p className="mt-6 text-center text-[12px] text-black/45">
          Billed monthly. Cancel any time. Annual billing coming soon.
        </p>
      </div>
    </section>
  );
}

function PlanCard({
  tier,
  price,
  cadence,
  tagline,
  features,
  cta,
  featured,
}: {
  tier: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  cta: string;
  featured: boolean;
}) {
  const bg = featured ? FOREST : "white";
  const text = featured ? "white" : "rgba(0,0,0,0.85)";
  const sub = featured ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
  const divider = featured ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  return (
    <div
      className="relative rounded-2xl p-7 md:p-8 border-2 shadow-sm transition hover:shadow-md"
      style={{
        background: bg,
        borderColor: featured ? GOLD : "rgba(0,0,0,0.06)",
      }}
    >
      {featured && (
        <div
          className="absolute -top-3 right-7 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.18em] font-bold"
          style={{ background: GOLD, color: FOREST }}
        >
          Most popular
        </div>
      )}
      <div className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-3"
        style={{ color: featured ? GOLD : FOREST }}
      >
        {tier}
      </div>
      <div className="flex items-baseline gap-1.5">
        <div
          className="text-5xl font-bold tabular-nums"
          style={{ color: text, fontFamily: "'Playfair Display', serif" }}
        >
          {price}
        </div>
        <div className="text-[14px]" style={{ color: sub }}>{cadence}</div>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: sub }}>
        {tagline}
      </p>
      <Link
        href="/sign-up"
        className="mt-6 block w-full py-3 rounded-xl text-center text-[14px] font-semibold transition hover:brightness-110 active:scale-95"
        style={
          featured
            ? { background: GOLD, color: FOREST }
            : { background: FOREST, color: "white" }
        }
      >
        {cta}
      </Link>
      <ul className="mt-7 space-y-2.5 pt-5 border-t" style={{ borderColor: divider }}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px]" style={{ color: sub }}>
            <span style={{ color: GOLD }} aria-hidden>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Comparison ────────────────────────────────────────────────────────────

function Comparison() {
  return (
    <section className="py-24" style={{ background: BONE_2 }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: FOREST }}>
            Side by side
          </div>
          <h2
            className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-black/85"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            What&apos;s in each tier
          </h2>
        </div>
        <div className="rounded-2xl bg-white border border-black/8 overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-black/8 bg-black/[0.02]">
                <th className="text-left px-5 py-4 font-medium text-black/55"></th>
                <th className="text-center px-5 py-4 font-semibold text-black/85">Explorer</th>
                <th className="text-center px-5 py-4 font-semibold" style={{ color: FOREST }}>
                  Operator
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-black/6 last:border-0">
                  <td className="px-5 py-3.5 text-black/70">{row.label}</td>
                  <td className="px-5 py-3.5 text-center text-black/65">
                    <Cell value={row.explorer} />
                  </td>
                  <td className="px-5 py-3.5 text-center text-black/85 font-medium" style={{ background: "rgba(201,168,76,0.04)" }}>
                    <Cell value={row.operator} accent />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Cell({ value, accent = false }: { value: string | boolean; accent?: boolean }) {
  if (value === true) {
    return <span style={{ color: accent ? FOREST : "rgba(0,0,0,0.65)" }}>✓</span>;
  }
  if (value === false) {
    return <span className="text-black/25">—</span>;
  }
  return <span>{value}</span>;
}

const COMPARISON_ROWS: { label: string; explorer: string | boolean; operator: string | boolean }[] = [
  { label: "Proposals per month",          explorer: "5",          operator: "Unlimited" },
  { label: "Property library",             explorer: true,         operator: true },
  { label: "Smart property ranking",       explorer: false,        operator: true },
  { label: "AI writing",                   explorer: "Basic",      operator: "Priority" },
  { label: "Brand DNA tone control",       explorer: false,        operator: true },
  { label: "Destination image library",    explorer: "Read-only",  operator: "Full" },
  { label: "Web view sharing",             explorer: true,         operator: true },
  { label: "Client comments",              explorer: true,         operator: true },
  { label: "PDF export",                   explorer: true,         operator: "Advanced" },
  { label: "Team seats",                   explorer: "1",          operator: "Up to 5" },
  { label: "Support",                      explorer: "Email",      operator: "Priority" },
];

// ─── Value pillars ─────────────────────────────────────────────────────────

function ValuePillars() {
  return (
    <section className="py-24" style={{ background: BONE }}>
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        <Pillar
          symbol="◇"
          title="Close one safari → pays for itself"
          body="A single closed booking covers the year. Operator tier breaks even on roughly 1 deal a year; most operators close that in the first month."
        />
        <Pillar
          symbol="◐"
          title="Save hours per proposal"
          body="Operators cut a 4-hour Word + Canva workflow to under 40 minutes. Time you can spend on the next client, not the last."
        />
        <Pillar
          symbol="◈"
          title="Look like the brand you are"
          body="Brand DNA + curated properties + destination-aware imagery means every proposal feels distinctly yours — not template #47."
        />
      </div>
    </section>
  );
}

function Pillar({ symbol, title, body }: { symbol: string; title: string; body: string }) {
  return (
    <div className="p-7 rounded-2xl bg-white border" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="text-3xl mb-4" style={{ color: FOREST }}>{symbol}</div>
      <h3 className="text-[16px] font-semibold text-black/85 leading-snug">{title}</h3>
      <p className="mt-2.5 text-[14px] leading-relaxed text-black/55">{body}</p>
    </div>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────────────────

function FAQ() {
  return (
    <section className="py-24" style={{ background: BONE_2 }}>
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: FOREST }}>
            Common questions
          </div>
          <h2
            className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-black/85"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Before you sign up
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((q) => (
            <details
              key={q.q}
              className="group rounded-xl bg-white border border-black/8 px-5 py-4 transition hover:border-black/15"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold text-black/85">{q.q}</span>
                <span className="text-black/35 group-open:rotate-45 transition text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-black/60">{q.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "Can I switch tiers later?",
    a: "Yes. Upgrade or downgrade any time from your settings — billing prorates automatically.",
  },
  {
    q: "Is there a free plan?",
    a: "No. We're not selling lite features to a wide audience — we're selling a serious tool to operators who close real safaris. Both tiers include the full editor and library.",
  },
  {
    q: "What happens if I exceed 5 proposals on Explorer?",
    a: "We won't lock anything mid-month. You'll be prompted to upgrade to Operator at the start of the next billing cycle.",
  },
  {
    q: "Can I bring my team?",
    a: "Operator tier includes up to 5 team seats inside one workspace, with role-based permissions. Larger teams: get in touch.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual billing with a small discount is coming soon. Email us if you'd like to be notified when it launches.",
  },
];

// ─── Footer ────────────────────────────────────────────────────────────────

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
          <Link href="/#how" className="hover:text-white/70 transition">How it works</Link>
          <Link href="/pricing" className="hover:text-white/70 transition">Pricing</Link>
          <Link href="/sign-up" className="hover:text-white/70 transition">Open Studio</Link>
        </div>
        <div>&copy; {new Date().getFullYear()} Safari Studio · Nairobi</div>
      </div>
    </footer>
  );
}
