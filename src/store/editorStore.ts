import { create } from "zustand";

export type EditorMode = "editor" | "preview" | "print";
export type ContextTab = "content" | "style" | "layout" | "advanced";

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
}

export const useEditorStore = create<EditorState>()((set) => ({
  mode: "editor",
  selectedSectionId: null,
  selectedDayId: null,
  selectedPropertyId: null,
  contextTab: "content",
  newProposalOpen: false,
  addSectionAfterOrder: null,
  floatingPicker: null,

  setMode: (mode) => set({ mode }),
  selectSection: (id) => set({ selectedSectionId: id, selectedDayId: null, selectedPropertyId: null }),
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
}));
