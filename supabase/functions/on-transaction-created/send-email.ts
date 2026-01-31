type ResendEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
};
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
export const sendResendEmail = async (payload: ResendEmailPayload) => {
  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error: ${response.status} ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to send Resend email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(message);
  }
};
