import { Resend } from "resend";
import {
  renderEmailTemplate,
  type TemplateId,
  type TemplateInputMap,
} from "@/services/notifications/templates";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM ??
  "FinHack Finance <no-reply@chuchube.com>";
export const sendSharedTransactionEmail = async ({
  to,
  payerEmail,
  amount,
  payee,
  accountName,
  gifUrl,
}: {
  to: string;
  payerEmail: string;
  amount: string;
  payee: string;
  accountName: string;
  gifUrl?: string;
}) => {
  if (!resendApiKey) {
    return;
  }

  const { html, text, subject } = renderEmailTemplate("shared-transaction", {
    payerEmail,
    amount,
    payee,
    accountName,
    gifUrl,
  });

  const resend = new Resend(resendApiKey);
  await resend.emails.send({
    from: resendFrom,
    to,
    subject,
    html,
    text,
  });
};

export const sendTemplatedEmail = async <T extends TemplateId>({
  to,
  templateId,
  input,
}: {
  to: string;
  templateId: T;
  input: TemplateInputMap[T];
}) => {
  if (!resendApiKey) {
    return;
  }

  const rendered =
    templateId === "shared-transaction"
      ? renderEmailTemplate(
          "shared-transaction",
          input as TemplateInputMap["shared-transaction"],
        )
      : renderEmailTemplate(
          "uncategorized-transaction",
          input as TemplateInputMap["uncategorized-transaction"],
        );

  const resend = new Resend(resendApiKey);
  await resend.emails.send({
    from: resendFrom,
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
};
