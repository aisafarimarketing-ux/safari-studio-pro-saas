// Editor-side types — what's loaded from the API and held in the form state.

export interface LocationLite {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
}

export interface TagLite {
  id: string;
  name: string;
}

export interface ImageItem {
  id?: string;       // present for existing rows; absent for newly uploaded
  url: string;
  caption: string | null;
  order: number;
  isCover: boolean;
}

export interface CustomSectionItem {
  id?: string;
  title: string;
  body: string | null;
  visible: boolean;
  order: number;
}

export interface RoomItem {
  id?: string;        // present for existing rows
  name: string;
  bedConfig: string;
  description: string;
  imageUrls: string[];
  order: number;
}

export interface PropertyForm {
  // Basics
  name: string;
  propertyClass: string;       // "" = unset
  locationId: string | null;

  // Story
  shortSummary: string;
  whatMakesSpecial: string;
  whyWeChoose: string;

  // Amenities
  amenities: string[];

  // Stay snapshot
  mealPlan: string;
  suggestedNights: number | null;
  suitability: string[];

  // Showcase facts — rendered in PropertyShowcaseSection's STATS sidebar
  checkInTime: string;
  checkOutTime: string;
  totalRooms: number | null;
  spokenLanguages: string[];
  specialInterests: string[];
  // Toggle for the Fun Facts block (rooms / languages / interests)
  // in the proposal showcase. Default true so existing properties
  // keep rendering as before.
  funFactsVisible: boolean;

  // Internal
  internalNotes: string;

  // Status
  archived: boolean;

  // Sub-collections
  images: ImageItem[];
  tagIds: string[];
  customSections: CustomSectionItem[];
  rooms: RoomItem[];
}

export const EMPTY_FORM: PropertyForm = {
  name: "",
  propertyClass: "",
  locationId: null,
  shortSummary: "",
  whatMakesSpecial: "",
  whyWeChoose: "",
  amenities: [],
  mealPlan: "",
  suggestedNights: null,
  suitability: [],
  checkInTime: "",
  checkOutTime: "",
  totalRooms: null,
  spokenLanguages: [],
  specialInterests: [],
  funFactsVisible: true,
  internalNotes: "",
  archived: false,
  images: [],
  tagIds: [],
  customSections: [],
  rooms: [],
};
