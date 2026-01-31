import type { TransactionSplitInput, WalletShareMember } from "../types";

export type WalletSplitMemberSummary = {
  userId: string;
  userEmail: string;
  role: string;
  contributionSplit: number;
  paid: number;
  share: number;
  owed: number;
};

export type WalletSplitSummary = {
  totalSpent: number;
  members: WalletSplitMemberSummary[];
};

export const calculateSplit = (
  transactions: TransactionSplitInput[],
  members: WalletShareMember[],
): WalletSplitSummary => {
  const relevant = transactions.filter((tx) => !tx.isSettlement);
  const settlements = transactions.filter(
    (tx) => tx.isSettlement && tx.settlementToUserId,
  );
  const totalSpent = relevant.reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0,
  );

  const paidByUser = new Map<string, number>();
  for (const tx of relevant) {
    const current = paidByUser.get(tx.paidByUserId) ?? 0;
    paidByUser.set(tx.paidByUserId, current + Math.abs(tx.amount));
  }

  const membersSummary = members.map((member) => {
    const share = Math.round((totalSpent * member.contributionSplit) / 100);
    const paid = paidByUser.get(member.userId) ?? 0;
    const owed = paid - share;
    return {
      userId: member.userId,
      userEmail: member.userEmail,
      role: member.role,
      contributionSplit: member.contributionSplit,
      paid,
      share,
      owed,
    };
  });

  if (settlements.length) {
    const owedByUser = new Map(
      membersSummary.map((member) => [member.userId, member.owed]),
    );

    for (const settlement of settlements) {
      const payerId = settlement.paidByUserId;
      const recipientId = settlement.settlementToUserId ?? undefined;
      if (!payerId || !recipientId) continue;

      const amount = Math.abs(settlement.amount);
      owedByUser.set(payerId, (owedByUser.get(payerId) ?? 0) + amount);
      owedByUser.set(
        recipientId,
        (owedByUser.get(recipientId) ?? 0) - amount,
      );
    }

    return {
      totalSpent,
      members: membersSummary.map((member) => ({
        ...member,
        owed: owedByUser.get(member.userId) ?? member.owed,
      })),
    };
  }

  return {
    totalSpent,
    members: membersSummary,
  };
};
