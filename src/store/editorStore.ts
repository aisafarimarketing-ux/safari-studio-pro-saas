import { create } from "zustand";

export type EditorMode = "editor" | "preview" | "print";
// Tabs simplified — the old quartet (content/style/layout/advanced) had
// three buttons doing the same job (Style and Layout rendered the same
// SectionPanel; Content was a help blurb). Two tabs now:
//
//  • "section" — variant + colors for the selected section
//  • "trip"    — proposal-level form (trip + client + operator) plus the
//                Regenerate / Added-info buttons that re-run autopilot
//  • "theme"   — global theme tokens
//
// Which of section/trip is shown depends on whether a section is
// selected; theme is always available.
export type ContextTab = "section" | "trip" | "theme";

export interface FloatingPickerState {
  x: number;
  y: number;
  color: string;
  token: string;
  sectionId: string | null;
}

interface EditorState {
  mode: EditorMode;
  selectedSectionId: string | null;
  selectedDayId: string | null;
  selectedPropertyId: string | null;
  contextTab: ContextTab;
  newProposalOpen: boolean;
  addSectionAfterOrder: number | null;
  floatingPicker: FloatingPickerState | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;

  setMode: (mode: EditorMode) => void;
  selectSection: (id: string | null) => void;
  selectDay: (id: string | null) => void;
  selectProperty: (id: string | null) => void;
  setContextTab: (tab: ContextTab) => void;
  openNewProposal: () => void;
  closeNewProposal: () => void;
  setAddSectionAfter: (order: number | null) => void;
  openFloatingPicker: (opts: Omit<FloatingPickerState, "sectionId"> & { sectionId?: string | null }) => void;
  closeFloatingPicker: () => void;
  setFloatingPickerColor: (color: string) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  mode: "editor",
  selectedSectionId: null,
  selectedDayId: null,
  selectedPropertyId: null,
  contextTab: "trip",
  newProposalOpen: false,
  addSectionAfterOrder: null,
  floatingPicker: null,
  leftPanelOpen: true,
  rightPanelOpen: true,

  setMode: (mode) => set({ mode }),
  selectSection: (id) =>
    set((s) => ({
      selectedSectionId: id,
      selectedDayId: null,
      selectedPropertyId: null,
      // Keep the tab choice coherent with what the panel can render: when
      // a section gets selected, default to its tab; when nothing is
      // selected, fall back to the trip-level form.
      contextTab: id ? (s.contextTab === "theme" ? "theme" : "section") : "trip",
    })),
  selectDay: (id) => set({ selectedDayId: id }),
  selectProperty: (id) => set({ selectedPropertyId: id }),
  setContextTab: (tab) => set({ contextTab: tab }),
  openNewProposal: () => set({ newProposalOpen: true }),
  closeNewProposal: () => set({ newProposalOpen: false }),
  setAddSectionAfter: (order) => set({ addSectionAfterOrder: order }),
  openFloatingPicker: (opts) =>
    set({ floatingPicker: { sectionId: null, ...opts } }),
  closeFloatingPicker: () => set({ floatingPicker: null }),
  setFloatingPickerColor: (color) =>
    set((s) => s.floatingPicker ? { floatingPicker: { ...s.floatingPicker, color } } : {}),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
}));
