import { create } from "zustand";

// Short-lived wizard state for the registration -> crop -> grid -> QR
// flow. Cleared once the greenhouse is fully set up; not persisted since
// re-entering the wizard should start clean.
export const useSetupStore = create((set) => ({
  greenhouseId: null,
  cropId: null,
  presetLabel: "3×4",
  setGreenhouseId: (id) => set({ greenhouseId: id }),
  setCropId: (id) => set({ cropId: id }),
  setPresetLabel: (label) => set({ presetLabel: label }),
  reset: () => set({ greenhouseId: null, cropId: null, presetLabel: "3×4" }),
}));
