import { create } from "zustand";

export type EditorMode = "editor" | "preview" | "print";
export type ContextTab = "content" | "style" | "layout" | "advanced";

interface EditorState {
  mode: EditorMode;
  selectedSectionId: string | null;
  selectedDayId: string | null;
  selectedPropertyId: string | null;
  contextTab: ContextTab;
  newProposalOpen: boolean;
  addSectionAfterOrder: number | null;

  setMode: (mode: EditorMode) => void;
  selectSection: (id: string | null) => void;
  selectDay: (id: string | null) => void;
  selectProperty: (id: string | null) => void;
  setContextTab: (tab: ContextTab) => void;
  openNewProposal: () => void;
  closeNewProposal: () => void;
  setAddSectionAfter: (order: number | null) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  mode: "editor",
  selectedSectionId: null,
  selectedDayId: null,
  selectedPropertyId: null,
  contextTab: "content",
  newProposalOpen: false,
  addSectionAfterOrder: null,

  setMode: (mode) => set({ mode }),
  selectSection: (id) => set({ selectedSectionId: id, selectedDayId: null, selectedPropertyId: null }),
  selectDay: (id) => set({ selectedDayId: id }),
  selectProperty: (id) => set({ selectedPropertyId: id }),
  setContextTab: (tab) => set({ contextTab: tab }),
  openNewProposal: () => set({ newProposalOpen: true }),
  closeNewProposal: () => set({ newProposalOpen: false }),
  setAddSectionAfter: (order) => set({ addSectionAfterOrder: order }),
}));
