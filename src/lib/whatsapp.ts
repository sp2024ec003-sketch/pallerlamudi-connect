/**
 * Fail-closed WhatsApp Cloud API adapter.
 * With MONTHLY_BUDGET_INR=0, all paid outbound sends are blocked.
 * Do not weaken this guard to bypass Meta pricing.
 */
export function assertApiSendingAllowed(estimatedCostInr: number) {
  const budget = Number(process.env.MONTHLY_BUDGET_INR ?? "0");
  const enabled = process.env.WHATSAPP_API_SEND_ENABLED === "true";

  if (!Number.isFinite(budget) || budget < 0) {
    throw new Error("Invalid messaging budget configuration");
  }
  if (!enabled) throw new Error("WhatsApp API sending is disabled by administrator");
  if (budget <= 0) throw new Error("₹0 budget: paid WhatsApp API sends are blocked");
  if (!Number.isFinite(estimatedCostInr) || estimatedCostInr < 0) {
    throw new Error("Invalid estimated message cost");
  }
  if (estimatedCostInr > budget) {
    throw new Error("Campaign exceeds authorized monthly budget");
  }
}

export async function sendTemplateMessage(
  toE164: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[],
  estimatedCostInr: number
) {
  assertApiSendingAllowed(estimatedCostInr);

  const version = process.env.META_GRAPH_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!version || !phoneNumberId || !token) throw new Error("Meta API is not configured");
  if (!/^\+[1-9]\d{7,14}$/.test(toE164)) throw new Error("Invalid E.164 recipient");

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toE164.replace("+", ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: bodyParameters.length ? [{
            type: "body",
            parameters: bodyParameters.map(text => ({ type: "text", text }))
          }] : []
        }
      })
    }
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Meta API request failed");
  return result.messages?.[0]?.id as string | undefined;
}
