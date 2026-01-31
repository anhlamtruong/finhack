import { create } from "zustand";

type ShareAccountState = {
  id: string;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
};

export const useShareAccount = create<ShareAccountState>((set) => ({
  id: "",
  isOpen: false,
  onOpen: (id: string) => set({ isOpen: true, id }),
  onClose: () => set({ isOpen: false, id: "" }),
}));
