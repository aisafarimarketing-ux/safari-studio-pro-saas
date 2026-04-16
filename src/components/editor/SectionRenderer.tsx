"use client";

import type { Section } from "@/lib/types";
import { OperatorHeaderSection } from "@/components/sections/OperatorHeaderSection";
import { CoverSection } from "@/components/sections/CoverSection";
import { GreetingSection } from "@/components/sections/GreetingSection";
import { TripSummarySection } from "@/components/sections/TripSummarySection";
import { ItineraryTableSection } from "@/components/sections/ItineraryTableSection";
import { DayJourneySection } from "@/components/sections/DayJourneySection";
import { PropertyShowcaseSection } from "@/components/sections/PropertyShowcaseSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { InclusionsSection } from "@/components/sections/InclusionsSection";
import { PracticalInfoSection } from "@/components/sections/PracticalInfoSection";
import { ClosingSection } from "@/components/sections/ClosingSection";
import { FooterSection } from "@/components/sections/FooterSection";
import { CustomTextSection } from "@/components/sections/CustomTextSection";
import { QuoteSection } from "@/components/sections/QuoteSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { DividerSection } from "@/components/sections/DividerSection";
import { SpacerSection } from "@/components/sections/SpacerSection";
import { MapSection } from "@/components/sections/MapSection";

export function SectionRenderer({ section }: { section: Section }) {
  switch (section.type) {
    case "operatorHeader": return <OperatorHeaderSection section={section} />;
    case "cover": return <CoverSection section={section} />;
    case "greeting": return <GreetingSection section={section} />;
    case "tripSummary": return <TripSummarySection section={section} />;
    case "itineraryTable": return <ItineraryTableSection section={section} />;
    case "dayJourney": return <DayJourneySection section={section} />;
    case "propertyShowcase": return <PropertyShowcaseSection section={section} />;
    case "pricing": return <PricingSection section={section} />;
    case "inclusions": return <InclusionsSection section={section} />;
    case "practicalInfo": return <PracticalInfoSection section={section} />;
    case "closing": return <ClosingSection section={section} />;
    case "footer": return <FooterSection section={section} />;
    case "customText": return <CustomTextSection section={section} />;
    case "quote": return <QuoteSection section={section} />;
    case "gallery": return <GallerySection section={section} />;
    case "divider": return <DividerSection section={section} />;
    case "spacer": return <SpacerSection section={section} />;
    case "map": return <MapSection section={section} />;
    default: return null;
  }
}
