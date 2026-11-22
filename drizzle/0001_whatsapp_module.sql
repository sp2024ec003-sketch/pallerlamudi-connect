CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN','PANCHAYAT_ADMIN','WARD_REPORTER','CONTENT_EDITOR','APPROVER')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_e164 TEXT UNIQUE NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  consent_status TEXT NOT NULL CHECK (consent_status IN ('OPTED_IN','OPTED_OUT','PENDING')),
  consent_source TEXT,
  consent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contact_consent_contact_idx ON contact_consent(contact_id);

CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS contact_group_members (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  PRIMARY KEY(contact_id, group_id)
);

CREATE TABLE IF NOT EXISTS message_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message_te TEXT,
  message_en TEXT,
  message_type TEXT NOT NULL DEFAULT 'PUBLIC_INFORMATION',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','BLOCKED','COMPLETED')),
  budget_inr NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (budget_inr >= 0),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES message_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  whatsapp_message_id TEXT,
  estimated_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(10,4),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  UNIQUE(campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES campaign_recipients(id),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hard guard: a campaign cannot be assigned a positive budget in zero-budget mode.
CREATE TABLE IF NOT EXISTS messaging_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_budget_inr NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monthly_budget_inr = 0),
  api_send_enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (api_send_enabled = FALSE)
);
INSERT INTO messaging_settings(id, monthly_budget_inr, api_send_enabled)
VALUES (1, 0, FALSE) ON CONFLICT (id) DO NOTHING;
