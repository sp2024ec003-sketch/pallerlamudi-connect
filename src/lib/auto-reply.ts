import { createHmac, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';

const globalPool = globalThis as unknown as { autoReplyPool?: Pool };
const pool = globalPool.autoReplyPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
if (process.env.NODE_ENV !== 'production') globalPool.autoReplyPool = pool;

export function verifyMetaSignature(rawBody: Buffer, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalize(s: string) { return s.toLocaleLowerCase().replace(/[\u200b\s]+/g, ' ').trim(); }
function detectLanguage(s: string): 'te' | 'en' {
  return /[\u0C00-\u0C7F]/.test(s) ? 'te' : 'en';
}

async function queueForAdmin(phone: string, wamid: string, reason: string, message: string) {
  await pool.query(`INSERT INTO whatsapp_admin_queue(phone_e164,inbound_wamid,reason,message_text)
    VALUES($1,$2,$3,$4) ON CONFLICT(inbound_wamid) DO NOTHING`, [phone, wamid, reason, message]);
}

async function sendServiceReply(to: string, body: string) {
  // Default is OFF. The first 1,000 service messages per number/month are currently
  // the free tier described by Meta's Oct-2026 rate-card change. Never exceed this cap.
  if (process.env.WHATSAPP_AUTO_REPLY_ENABLED !== 'true') return { sent: false, reason: 'AUTO_REPLY_DISABLED' };
  const version = process.env.META_GRAPH_VERSION;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!version || !phoneId || !token) return { sent: false, reason: 'META_NOT_CONFIGURED' };

  const monthKey = new Date().toISOString().slice(0, 7);
  const cap = Math.min(1000, Math.max(0, Number(process.env.FREE_SERVICE_MESSAGE_CAP ?? '1000')));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const usage = await client.query(`INSERT INTO whatsapp_monthly_usage(month_key,service_messages_sent)
      VALUES($1,0) ON CONFLICT(month_key) DO UPDATE SET month_key=EXCLUDED.month_key RETURNING service_messages_sent`, [monthKey]);
    if (Number(usage.rows[0].service_messages_sent) >= cap) {
      await client.query('ROLLBACK');
      return { sent: false, reason: 'FREE_TIER_CAP_REACHED' };
    }
    // Reserve one slot transactionally before the network call; failures release it.
    await client.query('UPDATE whatsapp_monthly_usage SET service_messages_sent=service_messages_sent+1,updated_at=now() WHERE month_key=$1', [monthKey]);
    await client.query('COMMIT');
  } finally { client.release(); }

  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace('+',''), type: 'text', text: { preview_url: false, body } }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? 'Meta send failed');
    return { sent: true, messageId: result.messages?.[0]?.id as string | undefined };
  } catch (error) {
    await pool.query('UPDATE whatsapp_monthly_usage SET service_messages_sent=GREATEST(service_messages_sent-1,0),updated_at=now() WHERE month_key=$1', [monthKey]);
    throw error;
  }
}

function referenceCode() { return `PLM-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; }

export async function processIncomingMessage(input: { wamid: string; from: string; text: string; type: string }) {
  const { wamid, from, text, type } = input;
  const inserted = await pool.query(`INSERT INTO whatsapp_inbound_events(wamid,from_phone,message_type,message_text,payload)
    VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(wamid) DO NOTHING RETURNING id`, [wamid, from, type, text, JSON.stringify(input)]);
  if (!inserted.rowCount) return { duplicate: true };

  const lang = detectLanguage(text);
  await pool.query(`INSERT INTO whatsapp_conversations(phone_e164,preferred_language,last_inbound_at,updated_at)
    VALUES($1,$2,now(),now()) ON CONFLICT(phone_e164) DO UPDATE SET preferred_language=EXCLUDED.preferred_language,last_inbound_at=now(),updated_at=now()`, [from, lang]);
  const conv = await pool.query('SELECT opted_out,state,state_data FROM whatsapp_conversations WHERE phone_e164=$1', [from]);
  if (conv.rows[0]?.opted_out) return { duplicate: false, optedOut: true };

  const clean = normalize(text);
  if (/^(stop|unsubscribe|ఆపు|వద్దు|నిలిపివేయండి)$/i.test(clean)) {
    await pool.query(`UPDATE whatsapp_conversations SET opted_out=true,state='IDLE',updated_at=now() WHERE phone_e164=$1`, [from]);
    return { optedOut: true };
  }
  if (/^(start|resume|ప్రారంభించు)$/i.test(clean)) {
    await pool.query(`UPDATE whatsapp_conversations SET opted_out=false,updated_at=now() WHERE phone_e164=$1`, [from]);
    const reply = lang === 'te' ? 'మళ్లీ స్వాగతం. మీకు ఏ సహాయం కావాలో సందేశం పంపండి.' : 'Welcome back. Send your question and we will help.';
    return { reply, ...(await sendServiceReply(from, reply)) };
  }

  const state = conv.rows[0]?.state as string;
  const stateData = conv.rows[0]?.state_data ?? {};
  if (state === 'COMPLAINT_WARD') {
    const ward = text.match(/\d+/)?.[0];
    if (!ward || Number(ward) < 1 || Number(ward) > 99) {
      const reply = lang === 'te' ? 'దయచేసి సరైన వార్డు నంబర్ పంపండి (ఉదా: 2).' : 'Please send a valid ward number (for example: 2).';
      return { reply, ...(await sendServiceReply(from, reply)) };
    }
    await pool.query(`UPDATE whatsapp_conversations SET state='COMPLAINT_DETAILS',state_data=$2::jsonb,updated_at=now() WHERE phone_e164=$1`, [from, JSON.stringify({ ward })]);
    const reply = lang === 'te' ? 'సమస్యను వివరంగా పంపండి. ప్రదేశం మరియు ఫోటో ఉంటే జత చేయండి.' : 'Please describe the issue, including the location. Attach a photo if available.';
    return { reply, ...(await sendServiceReply(from, reply)) };
  }
  if (state === 'COMPLAINT_DETAILS') {
    const ref = referenceCode();
    await pool.query(`INSERT INTO village_complaints(reference_code,phone_e164,language,ward,description)
      VALUES($1,$2,$3,$4,$5)`, [ref, from, lang, stateData.ward ?? null, text]);
    await pool.query(`UPDATE whatsapp_conversations SET state='IDLE',state_data='{}'::jsonb,updated_at=now() WHERE phone_e164=$1`, [from]);
    const reply = lang === 'te' ? `మీ సమస్య స్వీకరించబడింది. రిఫరెన్స్ నంబర్: ${ref}. ఇది పరిష్కారమైందని కాదు; సంబంధిత సిబ్బంది పరిశీలించిన తర్వాత స్థితి నవీకరించబడుతుంది.` : `Your report has been received. Reference: ${ref}. This is an acknowledgement, not confirmation of resolution. The status will be updated after staff review.`;
    await queueForAdmin(from, wamid, 'NEW_COMPLAINT', text);
    return { reply, ...(await sendServiceReply(from, reply)) };
  }

  if (/\b(complaint|report|problem|issue)\b|ఫిర్యాదు|సమస్య|నమోదు/.test(clean)) {
    await pool.query(`UPDATE whatsapp_conversations SET state='COMPLAINT_WARD',state_data='{}'::jsonb,updated_at=now() WHERE phone_e164=$1`, [from]);
    const reply = lang === 'te' ? 'సమస్య నమోదు చేద్దాం. ముందుగా మీ వార్డు నంబర్ పంపండి.' : 'Let us register the issue. First, please send your ward number.';
    return { reply, ...(await sendServiceReply(from, reply)) };
  }
  if (/\b(status|track)\b|స్థితి|స్టేటస్/.test(clean)) {
    const match = text.match(/PLM-\d{4}-[A-Z0-9]{6}/i);
    if (match) {
      const row = await pool.query('SELECT status FROM village_complaints WHERE reference_code=$1 AND phone_e164=$2', [match[0].toUpperCase(), from]);
      if (row.rowCount) {
        const status = row.rows[0].status;
        const reply = lang === 'te' ? `మీ ఫిర్యాదు స్థితి: ${status}.` : `Your complaint status: ${status}.`;
        return { reply, ...(await sendServiceReply(from, reply)) };
      }
    }
    const reply = lang === 'te' ? 'మీ రిఫరెన్స్ నంబర్ పంపండి (ఉదా: PLM-2026-ABC123). నంబర్ లేకపోతే అడ్మిన్ సహాయం కోసం అభ్యర్థన పంపండి.' : 'Send your reference number (for example: PLM-2026-ABC123). If you do not have it, ask for administrator assistance.';
    return { reply, ...(await sendServiceReply(from, reply)) };
  }

  const faq = await pool.query(`SELECT answer_te,answer_en FROM village_faqs WHERE approved=true AND
    (keywords_te && $1::text[] OR keywords_en && $2::text[]) LIMIT 1`, [Array.from(text.matchAll(/[\u0C00-\u0C7F]+/g), m => m[0]), clean.split(/[^a-z]+/).filter(Boolean)]);
  if (faq.rowCount) {
    const reply = lang === 'te' ? faq.rows[0].answer_te : faq.rows[0].answer_en;
    return { reply, ...(await sendServiceReply(from, reply)) };
  }

  await queueForAdmin(from, wamid, 'NEEDS_HUMAN_REVIEW', text);
  const reply = lang === 'te' ? 'మీ సందేశం అందింది. సరైన సమాచారం ఇవ్వడానికి మా నిర్వాహకుడికి పంపించాం. దయచేసి వేచి ఉండండి.' : 'We received your message and forwarded it to an administrator for a verified response. Please wait.';
  return { reply, ...(await sendServiceReply(from, reply)), handoff: true };
}

export async function markEventProcessed(wamid: string) {
  await pool.query('UPDATE whatsapp_inbound_events SET processed_at=now() WHERE wamid=$1', [wamid]);
}
