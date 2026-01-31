export type SplitAllocation = {
  userId: string;
  contributionSplit: number;
};

export const distributeSplits = (
  userIds: string[],
  total = 100,
): SplitAllocation[] => {
  if (userIds.length === 0) {
    return [];
  }

  const sorted = [...userIds].sort();
  const base = Math.floor(total / sorted.length);
  let remainder = total % sorted.length;

  return sorted.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return {
      userId,
      contributionSplit: base + extra,
    };
  });
};
