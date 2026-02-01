import {
  renderSharedTransactionEmail,
  sharedTransactionSubject,
  type SharedTransactionTemplateInput,
} from "./shared-transaction";
import {
  renderUncategorizedTransactionEmail,
  uncategorizedTransactionSubject,
  type UncategorizedTransactionTemplateInput,
} from "./uncategorized-transaction";

export type TemplateId = "shared-transaction" | "uncategorized-transaction";

export type TemplateInputMap = {
  "shared-transaction": SharedTransactionTemplateInput;
  "uncategorized-transaction": UncategorizedTransactionTemplateInput;
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
  templateId: "uncategorized-transaction",
  input: TemplateInputMap["uncategorized-transaction"],
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
    case "uncategorized-transaction":
      return {
        subject: uncategorizedTransactionSubject,
        ...renderUncategorizedTransactionEmail(input),
      };
  }

  const _exhaustive: never = templateId;
  throw new Error(`Unknown email template: ${_exhaustive}`);
}
