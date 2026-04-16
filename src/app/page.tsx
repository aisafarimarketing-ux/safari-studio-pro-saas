import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#1a1a1a]">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1b3a2d]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Leaf / paw mark */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c9a84c] font-bold text-lg"
              style={{ background: "rgba(201,168,76,0.18)" }}
            >
              S
            </div>
            <span className="text-white font-semibold text-[17px] tracking-tight">
              Safari Studio
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition">
              How it works
            </a>
            <a href="#pricing" className="hover:text-white transition">
              Pricing
            </a>
          </div>

          <Link
            href="/studio"
            className="px-5 py-2 rounded-lg text-[#1b3a2d] font-semibold text-sm transition hover:brightness-110 active:scale-95"
            style={{ background: "#c9a84c" }}
          >
            Open Studio
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="pt-16 relative overflow-hidden"
        style={{ background: "#1b3a2d" }}
      >
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #c9a84c 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Gradient fade to page bg at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{
            background: "linear-gradient(to bottom, transparent, #f8f5ef)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 py-28 md:py-36 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-medium mb-8"
            style={{
              background: "rgba(201,168,76,0.15)",
              color: "#c9a84c",
              border: "1px solid rgba(201,168,76,0.3)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#c9a84c" }}
            />
            Built for East African tour operators
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight max-w-4xl mx-auto">
            Proposals that sell
            <br />
            <span style={{ color: "#c9a84c" }}>the safari dream</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            A visual proposal builder designed exclusively for East African
            safari operators. Create multi-tier, day-by-day itineraries in
            minutes — not hours.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/studio"
              className="px-8 py-3.5 rounded-xl font-semibold text-[#1b3a2d] text-[15px] transition hover:brightness-110 active:scale-95 shadow-lg"
              style={{ background: "#c9a84c" }}
            >
              Build a Proposal Free
            </Link>
            <a
              href="#features"
              className="px-8 py-3.5 rounded-xl font-semibold text-white/80 text-[15px] transition hover:text-white"
              style={{ border: "1px solid rgba(255,255,255,0.2)" }}
            >
              See how it works
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-white/35 text-sm">
            Trusted by operators in Kenya · Tanzania · Uganda · Rwanda ·
            Botswana
          </p>
        </div>

        {/* Studio preview card floating out of hero */}
        <div className="relative max-w-5xl mx-auto px-6 -mb-8 z-10">
          <div
            className="rounded-2xl overflow-hidden shadow-2xl border"
            style={{ borderColor: "rgba(201,168,76,0.2)" }}
          >
            {/* Fake browser chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: "#162e22" }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: "#c9a84c" }}
              />
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: "rgba(201,168,76,0.3)" }}
              />
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: "rgba(201,168,76,0.15)" }}
              />
              <div
                className="ml-4 flex-1 max-w-xs rounded-md px-3 py-1 text-xs"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                safaristudio.co/studio
              </div>
            </div>
            {/* Preview mockup */}
            <div
              className="h-64 md:h-96 flex items-center justify-center"
              style={{ background: "#f3f0ea" }}
            >
              <div className="w-full h-full flex">
                {/* Left sidebar mock */}
                <div
                  className="w-32 h-full border-r p-4 space-y-2 hidden md:block"
                  style={{
                    background: "#f7f4ee",
                    borderColor: "rgba(0,0,0,0.08)",
                  }}
                >
                  {[
                    "Client",
                    "Summary",
                    "Day 1 · Nairobi",
                    "Day 2 · Mara",
                    "Day 3 · Mara",
                    "Pricing",
                  ].map((item, i) => (
                    <div
                      key={item}
                      className="rounded-md px-2 py-1 text-[11px]"
                      style={{
                        background: i === 1 ? "#1b3a2d" : "transparent",
                        color:
                          i === 1 ? "white" : "rgba(0,0,0,0.45)",
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {/* Canvas mock */}
                <div className="flex-1 p-4 space-y-3 overflow-hidden">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "white" }}
                  >
                    <div
                      className="text-xs mb-1"
                      style={{ color: "rgba(0,0,0,0.35)" }}
                    >
                      PROPOSAL FOR
                    </div>
                    <div className="text-xl font-semibold text-black/80">
                      Anderson Family Safari
                    </div>
                    <div className="text-sm text-black/40">
                      7 Days · Kenya &amp; Tanzania · July 2025
                    </div>
                  </div>
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: "white" }}
                  >
                    <div
                      className="h-16"
                      style={{
                        background:
                          "linear-gradient(135deg, #2d5a40 0%, #1b3a2d 100%)",
                      }}
                    />
                    <div className="p-3 flex gap-2">
                      <div
                        className="w-16 h-10 rounded"
                        style={{ background: "#e8e2d7" }}
                      />
                      <div className="space-y-1 flex-1">
                        <div
                          className="h-3 rounded w-20"
                          style={{ background: "#e8e2d7" }}
                        />
                        <div
                          className="h-2 rounded w-32"
                          style={{ background: "#ede8e0" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="pt-28 pb-24 bg-[#f8f5ef]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="text-xs uppercase tracking-[0.22em] font-semibold mb-3"
              style={{ color: "#1b3a2d" }}
            >
              Features
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-black/85 tracking-tight">
              Everything a safari operator needs
            </h2>
            <p className="mt-4 text-lg text-black/50 max-w-xl mx-auto">
              Built with the workflows of East African tour operators in mind —
              not generic travel agencies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: "◈",
                title: "Multi-tier pricing",
                desc: "Show Classic, Premier and Signature options side-by-side. Clients see the full range; upsells happen naturally.",
              },
              {
                icon: "✦",
                title: "Day-by-day itinerary",
                desc: "A structured canvas for every day: destination photo, property image, narrative, and accommodation options — all editable in place.",
              },
              {
                icon: "⟳",
                title: "Click-to-edit canvas",
                desc: "No forms to fill out. Click any text on the proposal and type. Your changes appear exactly as clients will see them.",
              },
              {
                icon: "◐",
                title: "One-click PDF export",
                desc: "Export a client-ready PDF directly from the browser. No InDesign, no Canva, no copy-paste between tools.",
              },
              {
                icon: "✧",
                title: "Safari-specific defaults",
                desc: "Pre-loaded with East African camps, destinations, and board types. Start with real data, not placeholder text.",
              },
              {
                icon: "⬡",
                title: "AI writing assistant",
                desc: "Ask AI to punch up a day description, rewrite for a family audience, or suggest alternative camps. It knows African safari.",
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="p-7 rounded-2xl border hover:border-[#c9a84c]/40 transition group"
                style={{
                  background: "white",
                  borderColor: "rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="text-3xl mb-4 transition"
                  style={{ color: "#1b3a2d" }}
                >
                  {feat.icon}
                </div>
                <h3 className="text-[17px] font-semibold text-black/85 mb-2">
                  {feat.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-black/55">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        id="how-it-works"
        className="py-24"
        style={{ background: "#1b3a2d" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="text-xs uppercase tracking-[0.22em] font-semibold mb-3"
              style={{ color: "#c9a84c" }}
            >
              How it works
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              From inquiry to inbox in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Open the Studio",
                desc: "Click Open Studio. A full sample Family Safari proposal is waiting — already populated.",
              },
              {
                step: "02",
                title: "Edit in place",
                desc: "Click any text or image placeholder to customise it for your client. The layout stays perfect.",
              },
              {
                step: "03",
                title: "Toggle your tiers",
                desc: "Show or hide Classic / Premier / Signature tiers in a single click. Price tables update instantly.",
              },
              {
                step: "04",
                title: "Export & send",
                desc: "Hit Export PDF to generate a beautiful, branded proposal. Send it while the client is still warm.",
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div
                  className="text-5xl font-bold mb-4 leading-none"
                  style={{ color: "rgba(201,168,76,0.25)" }}
                >
                  {s.step}
                </div>
                <h3 className="text-[17px] font-semibold text-white mb-2">
                  {s.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-white/50">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote / Testimonial ── */}
      <section className="py-24 bg-[#f8f5ef]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div
            className="text-6xl font-serif leading-none mb-6"
            style={{ color: "#c9a84c" }}
          >
            &ldquo;
          </div>
          <blockquote className="text-2xl md:text-3xl font-medium text-black/75 leading-[1.5] tracking-tight">
            Our conversion rate on proposals jumped the moment clients could
            actually see the camps, the days, the choice. Safari Studio made
            that possible without hiring a designer.
          </blockquote>
          <div className="mt-8 flex items-center justify-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ background: "#1b3a2d" }}
            >
              JM
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-black/75">
                James Mutua
              </div>
              <div className="text-xs text-black/40">
                Founder, Savanna Horizons · Nairobi
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section
        id="pricing"
        className="py-24"
        style={{ background: "#f3f0ea" }}
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div
            className="text-xs uppercase tracking-[0.22em] font-semibold mb-3"
            style={{ color: "#1b3a2d" }}
          >
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-black/85 tracking-tight mb-4">
            Free to build. Simple to scale.
          </h2>
          <p className="text-lg text-black/50 mb-12 max-w-xl mx-auto">
            Start building proposals today at no cost. When you&apos;re ready
            for unlimited exports, team seats and white-labelling, upgrade in
            one click.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {[
              {
                plan: "Explorer",
                price: "Free",
                features: [
                  "Unlimited proposals",
                  "3 PDF exports / month",
                  "All destination templates",
                  "AI writing (10 req/day)",
                ],
                cta: "Get started",
                highlighted: false,
              },
              {
                plan: "Operator",
                price: "$29 / month",
                features: [
                  "Everything in Explorer",
                  "Unlimited PDF exports",
                  "White-label branding",
                  "Team seats (up to 5)",
                  "Priority support",
                ],
                cta: "Start free trial",
                highlighted: true,
              },
            ].map((p) => (
              <div
                key={p.plan}
                className="p-8 rounded-2xl text-left border-2 transition"
                style={{
                  background: p.highlighted ? "#1b3a2d" : "white",
                  borderColor: p.highlighted
                    ? "#c9a84c"
                    : "rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="text-xs uppercase tracking-widest font-semibold mb-2"
                  style={{ color: p.highlighted ? "#c9a84c" : "#1b3a2d" }}
                >
                  {p.plan}
                </div>
                <div
                  className="text-3xl font-bold mb-6"
                  style={{ color: p.highlighted ? "white" : "#1a1a1a" }}
                >
                  {p.price}
                </div>
                <ul className="space-y-2 mb-8">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm"
                      style={{
                        color: p.highlighted
                          ? "rgba(255,255,255,0.75)"
                          : "rgba(0,0,0,0.65)",
                      }}
                    >
                      <span style={{ color: "#c9a84c" }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/studio"
                  className="block w-full py-3 rounded-xl text-center font-semibold text-sm transition hover:brightness-110"
                  style={
                    p.highlighted
                      ? { background: "#c9a84c", color: "#1b3a2d" }
                      : {
                          background: "#1b3a2d",
                          color: "white",
                        }
                  }
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="py-28 relative overflow-hidden"
        style={{ background: "#1b3a2d" }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #c9a84c 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight">
            Your next proposal
            <br />
            <span style={{ color: "#c9a84c" }}>starts right now</span>
          </h2>
          <p className="mt-6 text-white/55 text-lg max-w-xl mx-auto">
            No sign-up required. Open the Studio and start editing a real
            Family Safari proposal in seconds.
          </p>
          <Link
            href="/studio"
            className="inline-flex mt-10 px-10 py-4 rounded-xl font-bold text-[#1b3a2d] text-[16px] transition hover:brightness-110 active:scale-95 shadow-xl"
            style={{ background: "#c9a84c" }}
          >
            Open Safari Studio
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-10 border-t"
        style={{
          background: "#162e22",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/35">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-[#c9a84c] font-bold text-sm"
              style={{ background: "rgba(201,168,76,0.15)" }}
            >
              S
            </div>
            <span className="text-white/50 font-medium">Safari Studio</span>
          </div>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-white/60 transition">
              Features
            </a>
            <a href="#pricing" className="hover:text-white/60 transition">
              Pricing
            </a>
            <Link href="/studio" className="hover:text-white/60 transition">
              Studio
            </Link>
          </div>
          <div>
            &copy; {new Date().getFullYear()} Safari Studio · Nairobi, Kenya
          </div>
        </div>
      </footer>
    </div>
  );
}
