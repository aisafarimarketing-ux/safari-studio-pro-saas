// Property System — shared enums, labels, and types.
//
// Centralised here so the UI, API validators, and (later) AI selection
// logic agree on the canonical shape. Adding a new class / suitability /
// meal-plan option is a one-place change.

export const PROPERTY_CLASSES = [
  { id: "camp", label: "Camp" },
  { id: "tented_camp", label: "Tented Camp" },
  { id: "mobile_camp", label: "Mobile Camp" },
  { id: "lodge", label: "Lodge" },
  { id: "boutique_hotel", label: "Boutique Hotel" },
  { id: "villa", label: "Villa" },
  { id: "houseboat", label: "Houseboat" },
  { id: "treehouse", label: "Treehouse" },
  { id: "other", label: "Other" },
] as const;

export type PropertyClassId = (typeof PROPERTY_CLASSES)[number]["id"];

export const MEAL_PLANS = [
  { id: "full_board", label: "Full board" },
  { id: "all_inclusive", label: "All-inclusive" },
  { id: "half_board", label: "Half board" },
  { id: "bed_and_breakfast", label: "Bed & breakfast" },
  { id: "room_only", label: "Room only" },
] as const;

export type MealPlanId = (typeof MEAL_PLANS)[number]["id"];

export const SUITABILITY = [
  { id: "families", label: "Families" },
  { id: "honeymoon", label: "Honeymoon" },
  { id: "first_time", label: "First-time safari" },
  { id: "experienced", label: "Experienced travellers" },
  { id: "photography", label: "Photography" },
  { id: "small_groups", label: "Small groups" },
  { id: "large_groups", label: "Large groups" },
  { id: "kids_under_12", label: "Kids under 12" },
  { id: "accessible", label: "Accessibility-friendly" },
  { id: "solo", label: "Solo travellers" },
] as const;

export type SuitabilityId = (typeof SUITABILITY)[number]["id"];

// Helpers ──────────────────────────────────────────────────────────────────

export function classLabel(id: string | null | undefined): string {
  if (!id) return "Unclassified";
  return PROPERTY_CLASSES.find((c) => c.id === id)?.label ?? id;
}

export function suitabilityLabel(id: string): string {
  return SUITABILITY.find((s) => s.id === id)?.label ?? id;
}
