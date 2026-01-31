import { accounts, walletShares } from "@/db/schema";
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import { sendSharedTransactionEmail } from "@/services/notifications/resend";

export type DbClient = Parameters<typeof db.transaction>[0] extends (
  tx: infer T,
) => Promise<unknown> ? T
  : typeof db;

type SharedTransactionRow = {
  accountId: string;
  paidByUserId?: string | null;
  isSettlement?: boolean | null;
  amount: number;
  payee: string;
};

type CreateNotifierInput = {
  ctx: {
    user: {
      emailAddresses: Array<{ emailAddress: string }>;
    };
  };
  rows: SharedTransactionRow[];
};

export const createSharedTransactionNotifier = ({
  ctx,
  rows,
}: CreateNotifierInput) => {
  return async (dbClient: DbClient) => {
    const payerEmail = ctx.user.emailAddresses[0]?.emailAddress ?? "";
    const byAccount = new Map<string, SharedTransactionRow[]>();

    for (const row of rows) {
      const list = byAccount.get(row.accountId) ?? [];
      list.push(row);
      byAccount.set(row.accountId, list);
    }

    for (const [accountId, accountRows] of byAccount.entries()) {
      const [account] = await dbClient
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, accountId));

      const recipients = await dbClient
        .select({
          userEmail: walletShares.userEmail,
          userId: walletShares.userId,
        })
        .from(walletShares)
        .where(
          and(
            eq(walletShares.accountId, accountId),
            eq(walletShares.status, "accepted"),
          ),
        );

      for (const row of accountRows) {
        if (row.isSettlement) {
          continue;
        }

        const amount = formatCurrency(
          convertAmountFromMiliunits(Math.abs(row.amount)),
        );

        await Promise.all(
          recipients
            .filter((recipient) => recipient.userId !== row.paidByUserId)
            .filter((recipient) => recipient.userEmail)
            .map((recipient) =>
              sendSharedTransactionEmail({
                to: recipient.userEmail,
                payerEmail,
                amount,
                payee: row.payee,
                accountName: account?.name ?? "Shared account",
              })
            ),
        );
      }
    }
  };
};
