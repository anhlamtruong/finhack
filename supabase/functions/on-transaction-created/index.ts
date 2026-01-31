// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createDbClient } from "./_shared/client.ts";
import { accounts } from "./_shared/schema.ts";
import { eq } from "drizzle-orm/";

// SUPABASE_DB_URL is automatically injected by Supabase in production
const connectionString = Deno.env.get("DB_POOL_URL")!;
const db = createDbClient(connectionString);
console.log(
  `🔌 DB Connection String Status: ${
    connectionString ? `✅ Found: ${connectionString}` : "❌ MISSING"
  }`,
);
Deno.serve(async (req) => {
  //TODO: FIX this error
  try {
    const payload = await req.json();

    console.log(db);
    if (payload.type === "INSERT" && payload.table === "transactions") {
      const newRecord = payload.record;
      console.log(
        `⚡ New Transaction Detected: ${newRecord.id} - ${
          JSON.stringify(newRecord)
        }`,
      );
      const accountId = newRecord.account_id;
      if (!accountId) {
        throw new Error("Transaction is missing account_id");
      }
      const result = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          userEmail: accounts.userEmail,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId));

      console.log("✅ Drizzle Query Result:", result);

      // await sendResendEmail({
      //   from: RESEND_FROM_EMAIL,
      //   to: [RESEND_TO_EMAIL],
      //   subject: `New transaction: ${newRecord.payee ?? "Unknown"}`,
      //   text: `A new transaction was created: ${
      //     newRecord.payee ?? "Unknown"
      //   } (${newRecord.amount ?? ""}).`,
      //   html: `
      //     <h2>New transaction created</h2>
      //     <p><strong>Payee:</strong> ${newRecord.payee ?? "Unknown"}</p>
      //     <p><strong>Amount:</strong> ${newRecord.amount ?? ""}</p>
      //     <p><strong>ID:</strong> ${newRecord.id}</p>
      //   `,
      // });
    }

    return new Response(JSON.stringify({ message: "Webhook processed" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/on-transaction-created' \
    --header 'Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwODQ0NTk3OTl9.0h46uuWFAqoyX1e2j9TRWt_iQ60R2ZCFnWNXHw58hhN4MySu9sX_bthEytJxLVB25kxwthiUtwX3lOlEH4otrg' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
