import { create } from "zustand";

/**
 * Simple UI store for opening/closing the AI agent panel.
 */
type OpenAIAgentState = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

/**
 * Zustand store with open/close helpers.
 */
export const useOpenAIAgent = create<OpenAIAgentState>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
