import Link from "next/link";

// ─── Landing page ────────────────────────────────────────────────────────────
//
// Public marketing surface. Editorial / safari-luxury feel — deep forest,
// warm cream, gold accents, Playfair Display for editorial moments, plenty
// of breathing room. No hero image (we don't ship licensed photography
// yet); the visual showcase composes interface fragments + abstracted
// landscape blocks into a single proof-of-product mockup.
//
// CTA flow:
//   primary   → /sign-up  (Clerk handles signup → org task → /dashboard)
//   secondary → #how      (anchor to the 3-step section)

const FOREST = "#1b3a2d";
const FOREST_DEEP = "#142a20";
const GOLD = "#c9a84c";
const BONE = "#f8f5ef";
const BONE_2 = "#f3f0ea";

export default function HomePage() {
  return (
    <div className="min-h-screen text-[#1a1a1a]" style={{ background: BONE }}>
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <Differentiator />
      <Showcase />
      <BrandDNATease />
      <SpeedControl />
      <Pricing />
      <SocialProof />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
      style={{ background: "rgba(27,58,45,0.94)", borderColor: "rgba(255,255,255,0.08)" }}>
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
          <a href="#how" className="hover:text-white transition">How it works</a>
          <a href="#different" className="hover:text-white transition">Why it&apos;s different</a>
          <a href="#brand" className="hover:text-white transition">Brand DNA</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
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

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-16 relative overflow-hidden" style={{ background: FOREST }}>
      {/* Texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />
      {/* Bottom fade into bone */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, transparent, ${BONE})` }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-32 md:pt-32 md:pb-40 text-center">
        <Eyebrow color={GOLD}>Built for safari businesses</Eyebrow>

        <h1
          className="mt-7 text-5xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight max-w-4xl mx-auto"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Proposals your clients
          <br />
          can <em className="not-italic" style={{ color: GOLD }}>feel</em> — in a fraction of the time.
        </h1>

        <p className="mt-7 text-[17px] md:text-[19px] text-white/60 max-w-2xl mx-auto leading-relaxed">
          A proposal builder for tour operators, DMCs, and lodges. Pulls from
          your trusted properties, your brand voice, and your photography.
          Not a template generator.
        </p>

        <div
          className="mt-8 inline-flex items-center px-4 py-2 rounded-full text-[13px] font-medium"
          style={{ color: GOLD, background: "rgba(201,168,76,0.10)", border: `1px solid rgba(201,168,76,0.28)` }}
        >
          No generic AI. No random camps. Just your trusted properties — faster.
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href="/sign-up"
            className="px-7 py-3.5 rounded-xl font-semibold text-[15px] transition hover:brightness-110 active:scale-95 shadow-lg"
            style={{ background: GOLD, color: FOREST }}
          >
            Create your first proposal
          </Link>
          <a
            href="#how"
            className="px-7 py-3.5 rounded-xl font-semibold text-white/85 text-[15px] transition hover:text-white hover:bg-white/[0.04]"
            style={{ border: "1px solid rgba(255,255,255,0.18)" }}
          >
            See how it works
          </a>
        </div>

        <p className="mt-8 text-white/35 text-[13px]">
          Trusted by operators in Kenya · Tanzania · Uganda · Rwanda · Botswana
        </p>
      </div>

      <div className="relative max-w-5xl mx-auto px-6 -mb-12 z-10">
        <HeroMock />
      </div>
    </section>
  );
}

// Composed mockup — no real screenshot needed yet. Suggests the editor's
// shape (left rail of section/days, magazine-style canvas) so visitors
// understand the product without us shipping pixel art.
function HeroMock() {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border"
      style={{ borderColor: "rgba(201,168,76,0.20)" }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: FOREST_DEEP }}>
        <span className="w-3 h-3 rounded-full" style={{ background: GOLD }} />
        <span className="w-3 h-3 rounded-full" style={{ background: "rgba(201,168,76,0.3)" }} />
        <span className="w-3 h-3 rounded-full" style={{ background: "rgba(201,168,76,0.15)" }} />
        <div
          className="ml-4 flex-1 max-w-xs rounded-md px-3 py-1 text-[11px]"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
        >
          safaristudio.co/studio
        </div>
      </div>

      {/* App body */}
      <div className="grid grid-cols-[140px_1fr] h-72 md:h-[440px]" style={{ background: BONE }}>
        {/* Left rail */}
        <div className="border-r p-3 space-y-1 hidden md:block" style={{ background: BONE_2, borderColor: "rgba(0,0,0,0.06)" }}>
          {[
            "Cover",
            "Overview",
            "Day 1 · Nairobi",
            "Day 2 · Mara",
            "Day 3 · Mara",
            "Day 4 · Amboseli",
            "Pricing",
            "Departure",
          ].map((label, i) => (
            <div
              key={label}
              className="rounded-md px-2.5 py-1.5 text-[11px]"
              style={{
                background: i === 2 ? FOREST : "transparent",
                color: i === 2 ? "white" : "rgba(0,0,0,0.5)",
                fontWeight: i === 2 ? 600 : 400,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="p-5 space-y-4 overflow-hidden">
          {/* Hero block */}
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: "white" }}>
            <div
              className="h-24 md:h-32"
              style={{ background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)` }}
            />
            <div className="p-4">
              <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(0,0,0,0.4)" }}>
                Day 1 · Nairobi
              </div>
              <div
                className="text-[19px] md:text-[22px] font-bold mt-1"
                style={{ color: "rgba(0,0,0,0.85)", fontFamily: "'Playfair Display', serif" }}
              >
                Arrival into the Nairobi corridor
              </div>
              <div className="text-[12px] mt-1.5" style={{ color: "rgba(0,0,0,0.5)" }}>
                The Emakoko · Full board · Family suite
              </div>
            </div>
          </div>

          {/* Property block */}
          <div className="rounded-xl overflow-hidden shadow-sm flex" style={{ background: "white" }}>
            <div className="w-24 md:w-32 shrink-0" style={{ background: BONE_2 }} />
            <div className="p-3 flex-1 min-w-0">
              <div className="h-3 rounded w-2/3 mb-1.5" style={{ background: "rgba(0,0,0,0.08)" }} />
              <div className="h-2 rounded w-1/3 mb-2" style={{ background: "rgba(0,0,0,0.05)" }} />
              <div className="h-2 rounded w-full" style={{ background: "rgba(0,0,0,0.04)" }} />
              <div className="h-2 rounded w-5/6 mt-1" style={{ background: "rgba(0,0,0,0.04)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Problem ────────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section className="pt-32 pb-20" style={{ background: BONE }}>
      <div className="max-w-5xl mx-auto px-6">
        <SectionHeading
          eyebrow="The way you sell now"
          title="Word documents, Canva tabs, and version drift."
          sub="You know the product cold. The proposal still takes half a day. Three pain points operators tell us about every week:"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {PAINS.map((p) => (
            <PainCard key={p.title} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}

const PAINS = [
  {
    icon: "✕",
    title: "Six tools to send one proposal",
    body: "Word for the body, Canva for the cover, email to attach the camp factsheet, WhatsApp to chase the client. Nothing connects.",
  },
  {
    icon: "↻",
    title: "Every itinerary is built from scratch",
    body: "You've sold the same Mara loop a hundred times. You're still copy-pasting the same camp blurb between proposals.",
  },
  {
    icon: "≠",
    title: "v3, v3-final, v3-final-FINAL",
    body: "Pricing changed. The cover is wrong. The PDF you sent doesn't match the version your colleague is editing.",
  },
] as const;

function PainCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="p-7 rounded-2xl bg-white border" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[15px] font-semibold mb-4"
        style={{ background: "rgba(179,67,52,0.10)", color: "#b34334" }}
      >
        {icon}
      </div>
      <h3 className="text-[16px] font-semibold text-black/85">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-black/55">{body}</p>
    </div>
  );
}

// ─── Solution (how it works) ────────────────────────────────────────────────

function Solution() {
  return (
    <section id="how" className="py-28" style={{ background: BONE_2 }}>
      <div className="max-w-5xl mx-auto px-6">
        <SectionHeading
          eyebrow="A faster way"
          title="Built around how safari operators actually work."
          sub="Three steps. The first one is the hardest because you only do it once."
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <StepCard key={s.step} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    step: "01",
    title: "Curate",
    body: "Add your trusted camps and lodges once — photos, what makes them special, who they're right for. Your library, not a generic database.",
  },
  {
    step: "02",
    title: "Compose",
    body: "Drop properties straight into a proposal. The day cards, pricing tiers, and inclusions are already there. Edit in place — no forms.",
  },
  {
    step: "03",
    title: "Send",
    body: "Share a live link or export to PDF. The client sees what you crafted. You see when they open it.",
  },
] as const;

function StepCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="p-7 rounded-2xl bg-white border" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div
        className="text-[44px] font-bold leading-none mb-5"
        style={{ color: "rgba(201,168,76,0.65)", fontFamily: "'Playfair Display', serif" }}
      >
        {step}
      </div>
      <h3 className="text-[18px] font-semibold text-black/85">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-black/55">{body}</p>
    </div>
  );
}

// ─── Differentiator ─────────────────────────────────────────────────────────

function Differentiator() {
  return (
    <section id="different" className="py-32" style={{ background: BONE }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading
          eyebrow="Why it's different"
          title="Operator intelligence, not generic AI."
          sub="Three things every safari operator told us they wanted — and that no general-purpose tool will give them."
        />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Pillar
            symbol="◇"
            title="Built around your properties"
            body="The AI only suggests camps and lodges that are in your library. No surprise recommendations. No camps you don't sell."
          />
          <Pillar
            symbol="◈"
            title="Speaks in your brand voice"
            body="Brand DNA captures your tone — formal or warm, story-led or factual. Every generated paragraph sounds like you wrote it."
          />
          <Pillar
            symbol="◐"
            title="Visuals that match the place"
            body="Image selection is destination-aware: elephants in Tarangire, lions in the Serengeti, the right water for Zanzibar. Never random."
          />
        </div>
      </div>
    </section>
  );
}

function Pillar({ symbol, title, body }: { symbol: string; title: string; body: string }) {
  return (
    <div className="p-8 rounded-2xl border bg-white" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="text-3xl mb-5" style={{ color: FOREST }}>{symbol}</div>
      <h3 className="text-[17px] font-semibold text-black/85">{title}</h3>
      <p className="mt-2.5 text-[14px] leading-relaxed text-black/55">{body}</p>
    </div>
  );
}

// ─── Showcase ───────────────────────────────────────────────────────────────

function Showcase() {
  return (
    <section className="py-28" style={{ background: FOREST }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <Eyebrow color={GOLD}>See it in action</Eyebrow>
          <h2
            className="mt-5 text-4xl md:text-5xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            A proposal, not a document.
          </h2>
          <p className="mt-4 text-[15px] text-white/55 max-w-xl mx-auto">
            Day cards, property blocks, and tier pricing — already laid out, already on-brand.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <ShowcaseCard
            label="Day card"
            content={
              <>
                <div className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "rgba(0,0,0,0.4)" }}>
                  Day 4 · Amboseli
                </div>
                <div
                  className="text-[20px] font-semibold mt-1.5 leading-tight"
                  style={{ color: "rgba(0,0,0,0.85)", fontFamily: "'Playfair Display', serif" }}
                >
                  Elephants under Kilimanjaro
                </div>
                <div className="text-[12px] mt-1.5" style={{ color: "rgba(0,0,0,0.5)" }}>
                  Tortilis Camp · Full board
                </div>
                <div className="mt-3 text-[12px] leading-relaxed" style={{ color: "rgba(0,0,0,0.6)" }}>
                  Morning drive in the swamp. Long-tusker breeding herds at close
                  range. Back at camp by ten for breakfast on the deck.
                </div>
              </>
            }
          />
          <ShowcaseCard
            label="Property block"
            content={
              <>
                <div
                  className="h-20 -mx-5 -mt-5 mb-3 rounded-t-lg"
                  style={{ background: `linear-gradient(135deg, ${FOREST} 0%, #2d5a40 100%)` }}
                />
                <div className="text-[15px] font-semibold" style={{ color: "rgba(0,0,0,0.85)" }}>
                  Mara Plains Camp
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "rgba(0,0,0,0.5)" }}>
                  Olare Motorogi Conservancy · Tented Camp
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Family-friendly", "Conservancy access", "Night drives"].map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full text-[10px]"
                      style={{ background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.55)" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </>
            }
          />
          <ShowcaseCard
            label="Pricing tiers"
            content={
              <div className="space-y-2.5">
                {[
                  { name: "Classic", price: "$8,400 pp" },
                  { name: "Premier", price: "$11,200 pp", featured: true },
                  { name: "Signature", price: "$15,900 pp" },
                ].map((t) => (
                  <div
                    key={t.name}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      t.featured ? "border-2" : "border"
                    }`}
                    style={{
                      borderColor: t.featured ? GOLD : "rgba(0,0,0,0.08)",
                      background: t.featured ? "rgba(201,168,76,0.06)" : "transparent",
                    }}
                  >
                    <span className="text-[13px] font-semibold" style={{ color: "rgba(0,0,0,0.8)" }}>
                      {t.name}
                    </span>
                    <span className="text-[13px] font-mono" style={{ color: "rgba(0,0,0,0.65)" }}>
                      {t.price}
                    </span>
                  </div>
                ))}
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({ label, content }: { label: string; content: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-xl">
      <div
        className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-3"
        style={{ color: GOLD }}
      >
        {label}
      </div>
      {content}
    </div>
  );
}

// ─── Brand DNA tease ────────────────────────────────────────────────────────

function BrandDNATease() {
  return (
    <section id="brand" className="py-28" style={{ background: BONE }}>
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <Eyebrow>Brand DNA</Eyebrow>
          <h2
            className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-black/85"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Teaches the AI how you sound.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-black/55 max-w-md">
            Four sliders, two writing samples, and a list of the things you
            never want said in a proposal. The system layers your voice into
            every generated paragraph — and falls back gracefully when it
            doesn&apos;t know.
          </p>
          <p className="mt-3 text-[14px] text-black/45">
            Optional. Progressive. Never required to send a proposal.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 border" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {[
            { label: "Formal", right: "Conversational", value: 70 },
            { label: "Luxury", right: "Adventurous", value: 30 },
            { label: "Concise", right: "Detailed", value: 55 },
            { label: "Storytelling", right: "Informational", value: 80 },
          ].map((s) => (
            <div key={s.label} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between text-[12px] text-black/55 mb-1.5">
                <span>{s.label}</span>
                <span>{s.right}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.value}%`, background: FOREST }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Speed × Control ────────────────────────────────────────────────────────

function SpeedControl() {
  return (
    <section className="py-28" style={{ background: BONE_2 }}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <Eyebrow>Speed × control</Eyebrow>
        <h2
          className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-black/85"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          AI writes the first draft.<br /> You stay the operator.
        </h2>
        <p className="mt-6 text-[16px] leading-relaxed text-black/55 max-w-xl mx-auto">
          Generate a day narrative or a greeting in a click. Edit any line in
          place. Nothing&apos;s on rails — every word in every section is yours
          to change.
        </p>
        <div className="mt-10 inline-flex items-center gap-3 px-5 py-3 rounded-xl text-sm bg-white border"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: GOLD }}
          />
          <span className="text-black/65">
            Drafts auto-save. PDF and live link export are one click away.
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing teaser on the landing page ────────────────────────────────────
//
// Two-tier strip ($50 / $100) that lives alongside the editorial body. Full
// comparison is still on /pricing — this is the "before they leave the
// landing page" confidence card. The CTAs point at /sign-up; the detailed
// side-by-side table lives on /pricing.

function Pricing() {
  return (
    <section id="pricing" className="py-28" style={{ background: BONE }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <Eyebrow>Pricing</Eyebrow>
          <h2
            className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-black/85"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Two tiers. No free plan.
          </h2>
          <p className="mt-5 text-[16px] text-black/55 max-w-xl mx-auto leading-relaxed">
            Close one safari and Safari Studio pays for itself for the year.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <PricingCard
            tier="Explorer"
            price="$50"
            cadence="/ month"
            tagline="For solo operators sending proposals weekly."
            features={[
              "Up to 5 proposals / month",
              "Property library",
              "AI generation (basic)",
              "Web view sharing",
              "PDF export",
            ]}
            cta="Start Explorer"
            featured={false}
          />
          <PricingCard
            tier="Operator"
            price="$100"
            cadence="/ month"
            tagline="For DMCs and lodges who sell every day."
            features={[
              "Unlimited proposals",
              "Full property system",
              "Brand DNA — tone control",
              "Priority AI",
              "Advanced exports + 5 seats",
            ]}
            cta="Start Operator"
            featured
          />
        </div>

        <p className="mt-8 text-center text-[13px] text-black/50">
          <Link href="/pricing" className="underline hover:text-[#1b3a2d] transition">
            Full comparison →
          </Link>
        </p>
      </div>
    </section>
  );
}

function PricingCard({
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
  const text = featured ? "white" : "rgba(0,0,0,0.85)";
  const sub = featured ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
  const divider = featured ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  return (
    <div
      className="relative rounded-2xl p-7 md:p-8 border-2 shadow-sm transition hover:shadow-md"
      style={{
        background: featured ? FOREST : "white",
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
      <div
        className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-3"
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

// ─── Social proof ───────────────────────────────────────────────────────────

function SocialProof() {
  return (
    <section className="py-28" style={{ background: BONE }}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div
          className="text-6xl leading-none mb-6"
          style={{ color: GOLD, fontFamily: "'Playfair Display', serif" }}
        >
          &ldquo;
        </div>
        <blockquote
          className="text-2xl md:text-3xl font-medium text-black/80 leading-[1.5] tracking-tight max-w-3xl mx-auto"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          We were spending half a day per proposal. Safari Studio cut that
          to forty minutes — and the proposals look more like us, not less.
        </blockquote>
        <div className="mt-8 flex items-center justify-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
            style={{ background: FOREST }}
          >
            JM
          </div>
          <div className="text-left">
            <div className="text-[14px] font-semibold text-black/80">James Mutua</div>
            <div className="text-[12px] text-black/45">Founder · Savanna Horizons · Nairobi</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ──────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-32 relative overflow-hidden" style={{ background: FOREST }}>
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2
          className="text-4xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          The next proposal,<br />
          <span style={{ color: GOLD }}>built around your business.</span>
        </h2>
        <p className="mt-6 text-white/55 text-[16px] max-w-xl mx-auto">
          Open the Studio, add a property, draft a proposal. Free to try.
          No credit card.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex mt-10 px-9 py-4 rounded-xl font-bold text-[16px] transition hover:brightness-110 active:scale-95 shadow-xl"
          style={{ background: GOLD, color: FOREST }}
        >
          Open Safari Studio
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

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
          <a href="#how" className="hover:text-white/70 transition">How it works</a>
          <a href="#different" className="hover:text-white/70 transition">Why different</a>
          <Link href="/pricing" className="hover:text-white/70 transition">Pricing</Link>
          <Link href="/sign-up" className="hover:text-white/70 transition">Open Studio</Link>
        </div>
        <div>&copy; {new Date().getFullYear()} Safari Studio · Nairobi</div>
      </div>
    </footer>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function Eyebrow({ children, color = "#1b3a2d" }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="inline-block text-[11px] uppercase tracking-[0.24em] font-semibold"
      style={{ color }}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="mt-5 text-4xl md:text-[2.75rem] font-bold tracking-tight leading-[1.1] text-black/85"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {title}
      </h2>
      <p className="mt-5 text-[15px] md:text-[16px] leading-relaxed text-black/55">
        {sub}
      </p>
    </div>
  );
}
