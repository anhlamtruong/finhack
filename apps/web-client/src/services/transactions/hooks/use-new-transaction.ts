import { create } from "zustand";

export type TransactionFormValues = {
  amount?: number;
  payee?: string;
  category?: string; // Raw category string (for voice input)
  categoryId?: string;
  date?: Date;
  notes?: string;
  accountId?: string;
};

type NewTransactionState = {
  isOpen: boolean;
  initialValues: TransactionFormValues | null;
  onOpen: () => void;
  onClose: () => void;
  openWithValues: (values: TransactionFormValues) => void;
};

export const useNewTransaction = create<NewTransactionState>((set) => ({
  isOpen: false,
  initialValues: null,
  onOpen: () => set({ isOpen: true, initialValues: null }),
  onClose: () => set({ isOpen: false, initialValues: null }),
  openWithValues: (values) => set({ isOpen: true, initialValues: values }),
}));
