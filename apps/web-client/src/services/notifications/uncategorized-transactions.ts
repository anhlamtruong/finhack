import { accounts } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import { sendTemplatedEmail } from "@/services/notifications/resend";

export type DbClient = Parameters<typeof db.transaction>[0] extends (
  tx: infer T,
) => Promise<unknown> ? T
  : typeof db;

type UncategorizedTransactionRow = {
  id: string;
  accountId: string;
  paidByUserId?: string | null;
  isSettlement?: boolean | null;
  amount: number;
  payee: string;
  categoryId?: string | null;
};

type CreateNotifierInput = {
  ctx: {
    user: {
      emailAddresses: Array<{ emailAddress: string }>;
    };
  };
  rows: UncategorizedTransactionRow[];
};

export const createUncategorizedTransactionNotifier = ({
  ctx,
  rows,
}: CreateNotifierInput) => {
  return async (dbClient: DbClient) => {
    const payerEmail = ctx.user.emailAddresses[0]?.emailAddress ?? "";
    if (!payerEmail) {
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const byAccount = new Map<string, UncategorizedTransactionRow[]>();

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

      for (const row of accountRows) {
        if (row.isSettlement || row.categoryId) {
          continue;
        }

        const amount = formatCurrency(
          convertAmountFromMiliunits(Math.abs(row.amount)),
        );

        await sendTemplatedEmail({
          to: payerEmail,
          templateId: "uncategorized-transaction",
          input: {
            amount,
            payee: row.payee,
            accountName: account?.name ?? "Your account",
            transactionUrl: `${baseUrl}/transactions/${row.id}`,
          },
        });
      }
    }
  };
};