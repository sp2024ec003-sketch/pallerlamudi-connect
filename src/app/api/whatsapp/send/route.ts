import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertApiSendingAllowed } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await request.json();
    const estimatedCostInr = Number(body.estimatedCostInr ?? 0);
    // The guard executes before any Meta network request.
    assertApiSendingAllowed(estimatedCostInr);
    return NextResponse.json({ error: "Campaign sender not enabled in starter build" }, { status: 501 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
