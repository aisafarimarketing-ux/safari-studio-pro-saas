"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import type { Day, Section } from "@/lib/types";

// ─── Day-aware sticky nav ───────────────────────────────────────────────────
//
// Horizontal scrollable strip mirroring the itinerary flow. Built from the
// proposal's section + day data:
//
//   Cover · Welcome · Overview · Day 1 · Nairobi · Day 2 · Mara · … ·
//   Properties · Pricing · Departure
//
// Section types translate to canonical labels (so a proposal that doesn't
// have, say, a greeting just skips that nav entry). Day cards expand one
// entry per day inside the dayJourney section, keyed off DOM ids stamped
// in DayJourneySection / SectionChrome.
//
// Active highlighting via IntersectionObserver — the entry whose anchor is
// most prominent in the viewport gets the highlight.

const SECTION_LABELS: Record<string, string> = {
  cover: "Cover",
  greeting: "Welcome",
  tripSummary: "Overview",
  itineraryTable: "Itinerary",
  // dayJourney expands inline below
  propertyShowcase: "Properties",
  pricing: "Pricing",
  inclusions: "Inclusions",
  practicalInfo: "Practical info",
  closing: "Departure",
  // operatorHeader / footer / customText / quote — not navigable
};

type NavItem = {
  key: string;
  label: string;
  anchorId: string;       // DOM id to scroll into view + observe
  kind: "section" | "day";
};

export function EditorDayNav() {
  const { proposal } = useProposalStore();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  // Build the nav list deterministically from sections + days.
  const items = useMemo(() => buildNavItems(proposal.sections, proposal.days), [
    proposal.sections,
    proposal.days,
  ]);

  // Scroll-spy. Observe each anchor; whichever has the largest visible ratio
  // wins. rootMargin shifts the "active band" to roughly the top third of
  // the viewport so headings register as active *as they reach the top*,
  // not when they leave the bottom.
  useEffect(() => {
    if (items.length === 0) return;
    const elements = items
      .map((i) => document.getElementById(i.anchorId))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = items.findIndex((i) => i.anchorId === visible.target.id);
        if (idx >= 0) setActiveKey(items[idx].key);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // Keep the active chip visible inside the horizontal strip.
  useEffect(() => {
    if (!activeKey || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(`[data-nav-key="${activeKey}"]`);
    if (!el) return;
    const strip = stripRef.current;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const stripScroll = strip.scrollLeft;
    const stripRight = stripScroll + strip.clientWidth;
    if (elLeft < stripScroll + 32) {
      strip.scrollTo({ left: Math.max(0, elLeft - 32), behavior: "smooth" });
    } else if (elRight > stripRight - 32) {
      strip.scrollTo({ left: elRight - strip.clientWidth + 32, behavior: "smooth" });
    }
  }, [activeKey]);

  const onClick = (item: NavItem) => {
    const el = document.getElementById(item.anchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveKey(item.key);
  };

  if (items.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-black/10 bg-white/92 backdrop-blur">
      <div
        ref={stripRef}
        className="max-w-[1100px] mx-auto px-4 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar"
      >
        {items.map((item) => {
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              data-nav-key={item.key}
              onClick={() => onClick(item)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] transition whitespace-nowrap ${
                active
                  ? "bg-[#1b3a2d] text-white font-medium"
                  : "text-black/55 hover:text-black/85 hover:bg-black/[0.05]"
              } ${item.kind === "day" ? "" : "uppercase tracking-wider text-[11px]"}`}
              title={item.label}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Item construction ─────────────────────────────────────────────────────

function buildNavItems(sections: Section[], days: Day[]): NavItem[] {
  const sortedSections = [...sections].filter((s) => s.visible !== false).sort((a, b) => a.order - b.order);
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  const items: NavItem[] = [];
  for (const section of sortedSections) {
    if (section.type === "dayJourney") {
      for (const day of sortedDays) {
        items.push({
          key: `day:${day.id}`,
          label: dayLabel(day),
          anchorId: `day-${day.id}`,
          kind: "day",
        });
      }
      continue;
    }
    const label = SECTION_LABELS[section.type];
    if (!label) continue;
    items.push({
      key: `section:${section.id}`,
      label,
      anchorId: `section-${section.id}`,
      kind: "section",
    });
  }
  return items;
}

function dayLabel(day: Day): string {
  const dest = day.destination?.trim();
  if (!dest) return `Day ${day.dayNumber}`;
  return `Day ${day.dayNumber} · ${dest}`;
}
