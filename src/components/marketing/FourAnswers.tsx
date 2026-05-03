import { BG, CARD_BORDER, GREEN, INK, INK_2, SERIF } from "./tokens";

// Four product pillars — Visibility / Speed / Pipeline / Follow-up.
// Uniform-grid feel deliberately broken: first card highlighted with
// a green ring, third card pushed down 12px on lg+ so the row reads
// curated rather than templated.

const ITEMS = [
  {
    eyebrow: "Visibility",
    title: "Know who's ready to book.",
    body:
      "Engagement scoring shows the deals that need attention right now — viewed pricing, lingered on the itinerary, started the booking form.",
  },
  {
    eyebrow: "Speed",
    title: "Send proposals that close.",
    body:
      "Brand-locked templates render in seconds. AI helps you write personal notes that sound like you, not a marketing team.",
  },
  {
    eyebrow: "Pipeline",
    title: "Track every booking end-to-end.",
    body:
      "Reservations route to the assigned consultant, copy the owner, and land in the dashboard the moment a guest submits.",
  },
  {
    eyebrow: "Follow-up",
    title: "Never let a hot deal go cold.",
    body:
      "Quiet for 48h+? It surfaces in the follow-up rail with a one-tap nudge. The team always knows what to do next.",
  },
];

export function FourAnswers() {
  return (
    <section
      id="product"
      className="py-16 md:py-20"
      style={{
        background: "#fff",
        borderTop: `1px solid ${CARD_BORDER}`,
        borderBottom: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="text-center max-w-[680px] mx-auto">
          <div
            className="text-[10.5px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: GREEN }}
          >
            What operators want
          </div>
          <h2
            className="mt-3"
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 3.6vw, 36px)",
              lineHeight: 1.1,
              letterSpacing: "-0.018em",
              fontWeight: 600,
              color: INK,
            }}
          >
            The only four answers a safari team needs every morning.
          </h2>
          <p
            className="mt-3 text-[16px] leading-[1.6]"
            style={{ color: INK_2 }}
          >
            Safari Studio is built around the questions that actually move
            trips toward booked.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {ITEMS.map((it, i) => {
            const isLead = i === 0;
            const offset = i === 2 ? "lg:translate-y-3" : "";
            return (
              <article
                key={it.title}
                className={`rounded-2xl p-5 transition-all duration-150 ease-out hover:-translate-y-0.5 ${offset}`}
                style={{
                  background: isLead
                    ? `linear-gradient(180deg, #ffffff 0%, ${BG} 100%)`
                    : `linear-gradient(180deg, ${BG} 0%, #f0ece1 100%)`,
                  border: isLead
                    ? `1px solid rgba(47,143,70,0.32)`
                    : `1px solid rgba(0,0,0,0.10)`,
                  boxShadow: isLead
                    ? "0 1px 2px rgba(0,0,0,0.04), 0 12px 24px -10px rgba(47,143,70,0.20), inset 0 0 0 1px rgba(47,143,70,0.10)"
                    : "0 1px 2px rgba(0,0,0,0.04), 0 6px 14px -6px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="text-[9.5px] uppercase font-bold"
                  style={{ color: GREEN, letterSpacing: "0.28em" }}
                >
                  {it.eyebrow}
                </div>
                <h3
                  className="mt-3 text-[20px] leading-[1.18]"
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontWeight: 700,
                    letterSpacing: "-0.014em",
                  }}
                >
                  {it.title}
                </h3>
                <p
                  className="mt-2 text-[13.5px] leading-[1.55]"
                  style={{ color: "rgba(10,20,17,0.62)" }}
                >
                  {it.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
