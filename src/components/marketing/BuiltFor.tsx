"use client";

import { GREEN, INK, INK_2, SANS } from "./tokens";

// Built-for strip. Replaces a "trusted by" row — category labels
// only, never implies endorsement we don't have. Visual style stays
// close to a centred wordmark grid (uppercase, tracked spacing) so
// the section reads as social context, not a customer testimonial.
//
// Hover shifts each label to brand green so the row feels alive
// without bringing in heavy motion.

const CATEGORIES = [
  "WILDERNESS DMC",
  "RIVER LODGES",
  "OFF-GRID CAMPS",
  "PRIVATE GUIDES",
  "SAFARI BROKERS",
  "BOUTIQUE OPERATORS",
];

export function BuiltFor() {
  return (
    <section
      className="py-16 md:py-20"
      style={{ borderBottom: `1px solid rgba(0,0,0,0.10)` }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 text-center">
        <h2
          className="text-[20px] md:text-[24px]"
          style={{
            color: INK,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            letterSpacing: "-0.018em",
            lineHeight: 1.15,
          }}
        >
          Built for safari operators who sell, not just send proposals.
        </h2>
        <p className="mt-3 text-[15px]" style={{ color: INK_2 }}>
          Inspired by how high-performing safari teams sell, plan, follow up,
          and close trips.
        </p>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-10 gap-y-6 items-center">
          {CATEGORIES.map((label) => (
            <div
              key={label}
              className="text-[12.5px] font-bold text-center whitespace-nowrap transition-colors duration-150"
              style={{
                color: INK,
                fontFamily: SANS,
                letterSpacing: "0.34em",
                opacity: 0.82,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = GREEN;
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = INK;
                e.currentTarget.style.opacity = "0.82";
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
