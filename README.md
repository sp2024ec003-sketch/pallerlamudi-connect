# Pallerlamudi Connect — WhatsApp Selected-Contact Module

Starter implementation for a 1,000-contact, bilingual (Telugu/English) campaign manager.

## Financial safety design

`MONTHLY_BUDGET_INR=0` and `WHATSAPP_API_SEND_ENABLED=false` are the defaults.
The Cloud API adapter is intentionally **fail-closed**: it refuses every outbound API send while the budget is zero or API sending is disabled. Do not change these settings unless an administrator explicitly authorizes a non-zero budget and understands Meta's current rate card.

With a strict ₹0 budget, use the dashboard's `wa.me` links to open chats and press Send manually, or use WhatsApp Business broadcast lists where appropriate. This is not automatic API delivery. Avoid unofficial WhatsApp Web automation.

## Stack

- Next.js App Router + TypeScript
- Neon PostgreSQL
- Drizzle ORM
- n8n for import/notification/summary workflows
- WhatsApp Cloud API adapter (disabled by default)
- Manual WhatsApp handoff (`wa.me`) for zero-cost operation

## Quick start

1. Create a Neon project and copy its pooled or direct connection string.
2. Copy `.env.example` to `.env.local` and fill `DATABASE_URL`.
3. Run:
   ```bash
   npm install
   npm run db:migrate
   npm run dev
   ```
4. Open `http://localhost:3000`.
5. Add authentication before exposing this application publicly. The sample API route includes a placeholder admin guard that must be replaced with your real Auth.js/session implementation.
6. Import opted-in contacts only. The SQL schema records consent and opt-outs.

## Meta setup (when a paid API budget is later authorized)

1. Visit https://developers.facebook.com/ and create a Meta app.
2. Add the WhatsApp product.
3. In WhatsApp > API Setup, create/select a WhatsApp Business Account and use the test number first.
4. Record the Phone Number ID and WABA ID; configure a system-user token with least privilege.
5. Configure a public HTTPS webhook endpoint and verify token; subscribe to `messages` webhook fields.
6. Add and verify a dedicated sender number according to Meta's onboarding instructions. Do not assume a personal WhatsApp number can be used as a Cloud API sender. Check current Business App coexistence eligibility if you want to retain an existing Business App number.
7. Create approved templates for outbound messages outside the customer-service window. Use truthful categories; village-wide announcements may be classified as marketing by Meta depending on content/context.
8. Add billing only after setting a non-zero authorized budget. Keep `WHATSAPP_API_SEND_ENABLED=false` until the cost gate is tested.

Official docs:
- https://developers.facebook.com/documentation/business-messaging/whatsapp/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages

## Deploy

For a first deployment, use a Node.js host supporting Next.js and set the environment variables from `.env.example`. Keep Neon connection strings and Meta tokens server-side only. Run `npm run db:migrate` as a release step. n8n requires persistent hosting for reliable scheduled workflows; do not rely on a laptop or temporary tunnel for production.

## Important production checklist

- Replace `requireAdmin()` with real authentication and role authorization.
- Add rate limiting, CSRF protection where applicable, input validation, secure upload storage and backups.
- Configure Meta webhook signature verification before trusting webhook events.
- Keep the zero-budget gate enabled.
- Import only people who explicitly opted in to receive these updates; honor STOP/opt-out immediately.
- Do not upload sensitive personal data or use contact lists for political profiling.

## Attachments

Campaign attachments support PNG, JPG/JPEG, WEBP, PDF, DOC, DOCX, XLS and XLSX.
Maximum size is 10 MB per file. Files are uploaded directly to private S3-compatible
object storage using short-lived presigned URLs (Cloudflare R2 is one option).
Configure the `S3_*` variables in `.env.local`, run `drizzle/0002_attachments.sql`,
and mount `src/components/AttachmentUploader.tsx` inside the campaign editor.

Do not allow arbitrary executable/script formats. Production deployments should add
malware scanning, content-disposition controls, private download authorization and
retention policies. The upload route uses the starter admin-secret guard; replace it
with real session-based authentication before production.

## Bilingual hybrid WhatsApp auto-replies

Migration: run `drizzle/0003_auto_replies.sql` in Neon after `0001` and `0002`.

Webhook URL: `https://YOUR_DOMAIN/api/whatsapp/webhook`
- GET verifies Meta's `hub.verify_token` against `META_WEBHOOK_VERIFY_TOKEN`.
- POST verifies `X-Hub-Signature-256` against `META_APP_SECRET`, deduplicates by WhatsApp message ID, then routes supported FAQs and complaint intake.
- Unknown requests are written to `whatsapp_admin_queue`; no AI is allowed to invent Panchayat facts.
- Residents can send `STOP` / `ఆపు` to opt out. `START` / `ప్రారంభించు` opts back in.

### Enablement and cost guard

`WHATSAPP_AUTO_REPLY_ENABLED=false` is the default. Set it to `true` only after the Meta sender is verified, the webhook is subscribed to the WABA, the migration is applied, and a real inbound/outbound test is complete. The implementation caps service replies at `FREE_SERVICE_MESSAGE_CAP`, hard-limited to 1,000 per calendar month per sender. This cap is based on the October 2026 service-message allowance; messages beyond it are blocked, never silently billed. Templates, marketing, utility, authentication, AI-provider products, BSP charges, hosting, domain and storage may have separate costs. Do not enable templates or campaigns under the ₹0 plan.

### Meta webhook setup

1. In Meta for Developers, open your WhatsApp app > WhatsApp > Configuration.
2. Set Callback URL to `https://YOUR_DOMAIN/api/whatsapp/webhook`.
3. Set Verify Token to the exact `META_WEBHOOK_VERIFY_TOKEN` value.
4. Subscribe the app to the `messages` webhook field and ensure the app is subscribed to the correct WhatsApp Business Account.
5. Set `META_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and a currently supported `META_GRAPH_VERSION` in the hosting environment. Keep tokens server-side only.
6. Publish/deploy and send a test message from a separate phone.

### Known scope and production requirements

This is a deterministic hybrid starter, not a generative AI chatbot. It supports approved bilingual FAQs, complaint intake (ward then description), reference acknowledgement, complaint status lookup, STOP/START and admin handoff. It does not yet process incoming image/document media, send status updates when an admin changes a complaint, or provide the admin queue UI. Add authenticated admin screens, staff assignment, audit trail, rate limiting, retention controls and monitored retry/dead-letter handling before production. Do not collect Aadhaar, bank details, health data or other unnecessary sensitive data in chat.
