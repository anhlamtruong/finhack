import { RouterInputs } from "@/types/trpc";

export type InviteUserToAccountInput = RouterInputs["inviteUserToAccount"];

export type WalletShareMember = {
  userId: string;
  userEmail: string;
  role: string;
  contributionSplit: number;
  status: string;
};

export type TransactionSplitInput = {
  amount: number;
  paidByUserId: string;
  isSettlement: boolean | null;
  settlementToUserId?: string | null;
};
