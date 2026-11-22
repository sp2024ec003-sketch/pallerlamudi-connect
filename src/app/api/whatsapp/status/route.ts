import { NextResponse } from "next/server";
export async function GET() {
  const budget = Number(process.env.MONTHLY_BUDGET_INR ?? "0");
  const enabled = process.env.WHATSAPP_API_SEND_ENABLED === "true";
  return NextResponse.json({
    provider: "Meta WhatsApp Cloud API",
    apiConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
    apiSendingEnabled: enabled && budget > 0,
    monthlyBudgetInr: budget,
    mode: budget === 0 ? "MANUAL_ONLY_ZERO_SPEND" : enabled ? "API_ENABLED" : "API_DISABLED",
  });
}
