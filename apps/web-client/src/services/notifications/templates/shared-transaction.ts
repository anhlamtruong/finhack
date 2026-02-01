type SharedTransactionTemplateInput = {
  payerEmail: string;
  amount: string;
  payee: string;
  accountName: string;
  gifUrl?: string;
};

export const sharedTransactionSubject = "New shared wallet transaction";

export const renderSharedTransactionEmail = ({
  payerEmail,
  amount,
  payee,
  accountName,
  gifUrl,
}: SharedTransactionTemplateInput) => {
  const safeGif =
    gifUrl ??
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeWRzMmxjdjZsY2NlZWQyM3E5ZmJhMWIyejRjcDVpMzFrZWlibHNsdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/yBzRyo9EycRFseOw8Y/giphy.gif";

  const html = `
  <div style="margin:0;padding:0;background:#f5f6f8;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:linear-gradient(90deg,#7c3aed,#22c55e);height:6px;"></td>
            </tr>
            <tr>
              <td style="padding:24px 24px 0;">
                <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">New shared wallet activity</h1>
                <p style="margin:0;color:#6b7280;font-size:14px;">A new transaction was added to <strong>${accountName}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb;border-radius:12px;border:1px solid #eef2f7;">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-size:12px;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">Amount</div>
                      <div style="font-size:24px;font-weight:700;color:#10b981;margin-top:6px;">${amount}</div>
                    </td>
                    <td style="padding:16px;">
                      <div style="font-size:12px;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">Payee</div>
                      <div style="font-size:16px;font-weight:600;color:#111827;margin-top:6px;">${payee}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 16px;">
                <p style="margin:0;color:#374151;font-size:14px;">Added by <strong>${payerEmail}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px;">
                <img src="${safeGif}" alt="Transaction update" style="width:100%;max-width:552px;border-radius:12px;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px;">
                <div style="background:#111827;color:#ffffff;padding:12px 16px;border-radius:10px;font-size:13px;">
                  Tip: Keep an eye on your shared balance and settle up when it makes sense.
                </div>
              </td>
            </tr>
          </table>
          <p style="margin-top:12px;color:#9ca3af;font-size:12px;">You’re receiving this because you’re a member of ${accountName}.</p>
        </td>
      </tr>
    </table>
  </div>
  `;

  const text = `New shared wallet activity\n\n${amount} at ${payee} in ${accountName}. Added by ${payerEmail}.`;

  return { html, text };
};

export type { SharedTransactionTemplateInput };
