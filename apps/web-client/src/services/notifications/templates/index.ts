import {
  renderSharedTransactionEmail,
  sharedTransactionSubject,
  type SharedTransactionTemplateInput,
} from "./shared-transaction";

export type TemplateId = "shared-transaction";

export type TemplateInputMap = {
  "shared-transaction": SharedTransactionTemplateInput;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text?: string;
};

export function renderEmailTemplate(
  templateId: "shared-transaction",
  input: TemplateInputMap["shared-transaction"],
): RenderedEmail;
export function renderEmailTemplate(
  templateId: TemplateId,
  input: TemplateInputMap[TemplateId],
): RenderedEmail {
  switch (templateId) {
    case "shared-transaction":
      return {
        subject: sharedTransactionSubject,
        ...renderSharedTransactionEmail(input),
      };
  }

  const _exhaustive: never = templateId;
  throw new Error(`Unknown email template: ${_exhaustive}`);
}
