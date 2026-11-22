import { NextRequest, NextResponse } from 'next/server';
import { markEventProcessed, processIncomingMessage, verifyMetaSignature } from '@/lib/auto-reply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }
  let body: any;
  try { body = JSON.parse(raw.toString('utf8')); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Acknowledge quickly; process each message once. Meta retries are neutralized by wamid uniqueness.
  const messages = (body.entry ?? []).flatMap((entry: any) => entry.changes ?? [])
    .filter((change: any) => change.field === 'messages')
    .flatMap((change: any) => change.value?.messages ?? []);
  try {
    for (const message of messages) {
      const from = String(message.from ?? '').replace(/\D/g, '');
      const text = message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title ?? '';
      if (!message.id || !from) continue;
      const result = await processIncomingMessage({ wamid: message.id, from: `+${from}`, text: String(text), type: String(message.type ?? 'unknown') });
      if (!result.duplicate && 'reply' in result && result.reply && 'sent' in result && result.sent) await markEventProcessed(message.id);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('WhatsApp webhook processing error', error);
    // Return 200 to avoid endless retries after a partially processed batch; failures are logged.
    return NextResponse.json({ received: true, processingError: true });
  }
}
