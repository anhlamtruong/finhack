import { db } from "@/db";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  accounts,
  categories,
  connectedBanks,
  transactions,
} from "@/db/schema";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import { z } from "zod";
import { convertAmountToMiliunits } from "@/lib/utils";

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_TOKEN,
      "PLAID-SECRET": process.env.PLAID_SECRET_TOKEN,
    },
  },
});

const client = new PlaidApi(configuration);

const app = new Hono().get("/connected-bank", clerkMiddleware(), async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const [connectedBank] = await db.select().from(connectedBanks).where(
    eq(connectedBanks.userId, auth.userId),
  );

  return c.json({ data: connectedBank || null });
}).delete("/connected-bank", clerkMiddleware(), async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const [connectedBank] = await db.delete(connectedBanks).where(
    eq(connectedBanks.userId, auth.userId),
  ).returning();

  if (!connectedBank) {
    return c.json({ error: "Not found" }, 404);
  }

  await db.delete(accounts).where(
    and(eq(accounts.userId, auth.userId), isNotNull(accounts.plaidId)),
  );

  return c.json({ data: connectedBank });
}).post(
  "/create-link-token",
  clerkMiddleware(),
  async (c) => {
    try {
      const auth = getAuth(c);
      if (!auth?.userId) {
        return c.json(
          {
            error: "Unauthorized",
          },
          401,
        );
      }
      const token = await client.linkTokenCreate({
        user: { client_user_id: auth.userId },
        client_name: "FinHack Finance",
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: "en",
      });

      return c.json({
        data: token.data.link_token,
      }, 200);
    } catch (error) {
      console.error("API_ERROR_SUMMARY", error);
      return c.json(
        {
          error: "Internal Server Error",
          message: "Failed to fetch financial data api/summary",
        },
        500,
      );
    }
  },
).post(
  "/exchange-public-token",
  clerkMiddleware(),
  zValidator("json", z.object({ publicToken: z.string() })),
  async (c) => {
    try {
      const auth = getAuth(c);
      if (!auth?.userId) {
        return c.json(
          {
            error: "Unauthorized",
          },
          401,
        );
      }
      const clerkClient = c.get("clerk");
      const user = await clerkClient.users.getUser(auth?.userId);
      const userEmail = user.emailAddresses[0].emailAddress;
      const { publicToken } = c.req.valid("json");

      if (!publicToken) {
        return c.json(
          {
            error: "Public Token not found!",
          },
          400,
        );
      }

      const exchange = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const [connectedBank] = await db.insert(connectedBanks).values({
        id: uuidv4(),
        userId: auth.userId,
        accessToken: exchange.data.access_token,
      }).returning();

      const plaidTransactions = await client.transactionsSync({
        access_token: connectedBank.accessToken,
      });

      const plaidAccounts = await client.accountsGet({
        access_token: connectedBank.accessToken,
      });

      const uniquePlaidCategoryNames = Array.from(
        new Set(
          plaidTransactions.data.added
            .filter((t) => t.personal_finance_category)
            .map((t) => t.personal_finance_category!.detailed),
        ),
      );

      const newAccounts = await db.insert(accounts).values(
        plaidAccounts.data.accounts.map((account) => ({
          id: uuidv4(),
          name: account.name,
          plaidId: account.account_id,
          userId: auth.userId,
          userEmail: userEmail,
        })),
      ).returning();

      const newCategories = await db.insert(categories).values(
        uniquePlaidCategoryNames.map((category) => ({
          id: uuidv4(),
          name: category,
          plaidId: category,
          userId: auth.userId,
        })),
      ).returning();

      const newTransactionsValues = plaidTransactions.data.added.reduce(
        (acc, transaction) => {
          const account = newAccounts.find((account) =>
            account.plaidId === transaction.account_id
          );
          const category = newCategories.find((category) =>
            category.plaidId === transaction.personal_finance_category?.detailed
          );
          const amountInMiliunits = convertAmountToMiliunits(
            transaction.amount,
          );

          if (account) {
            acc.push({
              id: uuidv4(),
              amount: amountInMiliunits,
              payee: transaction.merchant_name || transaction.name,
              notes: transaction.merchant_name,
              date: new Date(transaction.date),
              accountId: account.id,
              categoryId: category?.id,
              paidByUserId: auth.userId,
              isSettlement: false,
            });
          }
          return acc;
        },
        [] as typeof transactions.$inferInsert[],
      );

      if (newTransactionsValues.length > 0) {
        await db.insert(transactions).values(newTransactionsValues);
      }

      return c.json({
        ok: true,
      }, 200);
    } catch (error) {
      console.error("API_ERROR_SUMMARY", error);
      return c.json(
        {
          error: "Internal Server Error",
          message: "Failed to fetch financial data api/summary",
        },
        500,
      );
    }
  },
);

export default app;
