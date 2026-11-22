# n8n workflows

Import the JSON files through n8n > Workflows > Import from File.

These starter workflows intentionally do not send WhatsApp messages. They accept internal webhooks and create processing/audit records or summaries. Do not connect an HTTP Request node to Meta send endpoint while budget is ₹0.

Configure:
- `N8N_WEBHOOK_SECRET`
- A credential for your internal API
- Neon database credentials only if you choose direct database access (prefer authenticated app API)

Workflow files:
- `01-report-intake.json`
- `02-campaign-zero-budget-gate.json`
- `03-weekly-summary-trigger.json`

For production, add authentication, error workflow, execution retention and monitoring.
