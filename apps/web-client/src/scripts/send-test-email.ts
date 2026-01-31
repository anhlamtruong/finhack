import { sendTemplatedEmail } from "@/services/notifications/resend";

const [templateIdArg, toArg] = process.argv.slice(2);

const templateId =
  (templateIdArg || "shared-transaction") as "shared-transaction";
const to = toArg || process.env.TEST_EMAIL || "anhlamtruong1012@gmail.com";

if (!to) {
  console.error("Missing recipient. Pass email as arg or set TEST_EMAIL.");
  process.exit(1);
}

async function run() {
  if (templateId === "shared-transaction") {
    await sendTemplatedEmail({
      to,
      templateId: "shared-transaction",
      input: {
        payerEmail: "demo@chuchube.com",
        amount: "$24.50",
        payee: "Coffee Shop",
        accountName: "Vacation Fund",
        gifUrl:
          "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3N6Z2JtNnU1YjZ0MDFwMGlqZ2F0cXJvZ3R5a3B1M2o1a2FqNiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26ufdipQqU2lhNA4g/giphy.gif",
      },
    });
  }

  console.log(`Sent test email to ${to} using ${templateId}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
