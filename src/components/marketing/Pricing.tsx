import Link from "next/link";
import {
  GOLD,
  GREEN,
  GREEN_BRIGHT,
  HERO_BOTTOM,
  HERO_TOP,
  SERIF,
} from "./tokens";

// Three-tier pricing on a dark gradient. The Pro tier is visibly
// dominant — scaled lg:1.04, gold border + halo, gold "Most popular"
// pill, larger price + gold CTA so it reads as the obvious pick.
//
// Header treats the two clauses with different weight: "Simple
// pricing." sits muted, "Powerful results." pops in gold with a
// soft text-shadow.

export function Pricing() {
  return (
    <section
      id="pricing"
      className="py-16 md:py-20 relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${HERO_BOTTOM} 0%, ${HERO_TOP} 100%)`,
        color: "#fff",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="max-w-[1200px] mx-auto px-6 md:px-8 relative">
        <div className="text-center max-w-[640px] mx-auto">
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 3.6vw, 36px)",
              lineHeight: 1.08,
              letterSpacing: "-0.022em",
              fontWeight: 700,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.78)" }}>
              Simple pricing.
            </span>{" "}
            <span
              style={{
                color: GOLD,
                textShadow: "0 1px 14px rgba(224,184,92,0.32)",
              }}
            >
              Powerful results.
            </span>
          </h2>
          <p
            className="mt-3 text-[16px] leading-[1.55]"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Close one safari and Safari Studio pays for itself.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          <PriceCard
            name="Starter"
            price="$59"
            cadence="/ month"
            tagline="For solo consultants and small teams."
            features={[
              "Up to 30 proposals / month",
              "Engagement scoring + dashboard",
              "Branded share view",
              "Email notifications on bookings",
            ]}
            ctaLabel="Start free trial"
            ctaHref="/sign-up"
          />
          <PriceCard
            name="Pro"
            price="$149"
            cadence="/ month"
            tagline="For growing operators ready to scale."
            features={[
              "Unlimited proposals + reservations",
              "Team supervision + role permissions",
              "AI Write + Brand DNA",
              "Activity feed + follow-up automation",
              "Priority email support",
            ]}
            ctaLabel="Start free trial"
            ctaHref="/sign-up"
            featured
          />
          <PriceCard
            name="Enterprise"
            price="Custom"
            cadence=""
            tagline="For multi-brand DMCs and enterprises."
            features={[
              "Everything in Pro",
              "Dedicated success manager",
              "SSO + custom roles",
              "Bespoke integrations (GHL, Salesforce, etc.)",
              "SLA-backed uptime",
            ]}
            ctaLabel="Talk to us"
            ctaHref="/sign-up"
          />
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-[13px] font-semibold underline-offset-4 hover:underline"
            style={{ color: GOLD }}
          >
            See full pricing details →
          </Link>
        </div>
      </div>
    </section>
  );
}

function PriceCard({
  name,
  price,
  cadence,
  tagline,
  features,
  ctaLabel,
  ctaHref,
  featured = false,
}: {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl relative transition-transform duration-200 ${
        featured ? "p-7 md:scale-[1.04] md:z-[1]" : "p-6"
      }`}
      style={{
        background: featured
          ? "linear-gradient(180deg, rgba(224,184,92,0.18) 0%, rgba(255,255,255,0.04) 100%)"
          : "rgba(255,255,255,0.03)",
        border: featured
          ? `1px solid rgba(224,184,92,0.65)`
          : `1px solid rgba(255,255,255,0.12)`,
        boxShadow: featured
          ? "0 1px 2px rgba(0,0,0,0.10), 0 18px 40px -12px rgba(224,184,92,0.45), inset 0 1px 0 rgba(255,255,255,0.10)"
          : "none",
      }}
    >
      {featured && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.26em] font-bold px-3 py-1 rounded-full"
          style={{
            background: `linear-gradient(180deg, #f0cb74 0%, ${GOLD} 100%)`,
            color: HERO_TOP,
            boxShadow:
              "0 6px 14px -4px rgba(224,184,92,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
          }}
        >
          Most popular
        </div>
      )}

      <div
        className="text-[11.5px] uppercase tracking-[0.26em] font-bold"
        style={{ color: featured ? GOLD : "rgba(255,255,255,0.55)" }}
      >
        {name}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span
          className="text-white"
          style={{
            fontFamily: SERIF,
            fontSize: featured ? 48 : 42,
            fontWeight: 700,
            letterSpacing: "-0.028em",
            lineHeight: 1,
          }}
        >
          {price}
        </span>
        {cadence && (
          <span
            className="text-[12.5px]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {cadence}
          </span>
        )}
      </div>
      <p
        className="mt-2 text-[13px] leading-[1.5]"
        style={{ color: "rgba(255,255,255,0.68)" }}
      >
        {tagline}
      </p>

      <a
        href={ctaHref}
        className="mt-6 inline-flex w-full items-center justify-center px-4 rounded-lg text-[14.5px] font-bold transition-all duration-150 active:scale-[0.97] hover:brightness-110 hover:scale-[1.02]"
        style={
          featured
            ? {
                background: `linear-gradient(180deg, #f0cb74 0%, ${GOLD} 100%)`,
                color: HERO_TOP,
                height: 52,
                boxShadow:
                  "0 10px 22px -6px rgba(224,184,92,0.65), inset 0 1px 0 rgba(255,255,255,0.45)",
              }
            : {
                background: `linear-gradient(180deg, ${GREEN_BRIGHT} 0%, ${GREEN} 100%)`,
                color: "#fff",
                height: 48,
                boxShadow:
                  "0 8px 18px -6px rgba(47,143,70,0.55), inset 0 1px 0 rgba(255,255,255,0.16)",
              }
        }
      >
        {ctaLabel}
      </a>

      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[13.5px]">
            <span
              aria-hidden
              className="mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
              style={{
                background: featured ? GOLD : GREEN,
                color: featured ? HERO_TOP : "#fff",
                boxShadow: featured
                  ? "0 2px 6px -2px rgba(224,184,92,0.5)"
                  : "0 2px 6px -2px rgba(47,143,70,0.4)",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 11 11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 5.5 L4.5 8 L9 3" />
              </svg>
            </span>
            <span style={{ color: "rgba(255,255,255,0.88)" }}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
