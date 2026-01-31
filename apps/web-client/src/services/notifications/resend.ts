import { Resend } from "resend";
import {
  renderEmailTemplate,
  type TemplateId,
  type TemplateInputMap,
} from "@/services/notifications/templates";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM ??
  "Chuchube Finance <no-reply@chuchube.com>";
//TODO: Follow the architechture, have a nice UI for email
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

  const { html, text, subject } = renderEmailTemplate(templateId, input);
  const resend = new Resend(resendApiKey);
  await resend.emails.send({
    from: resendFrom,
    to,
    subject,
    html,
    text,
  });
};
