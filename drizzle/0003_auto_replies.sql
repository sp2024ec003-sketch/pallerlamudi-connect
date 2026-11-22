-- Bilingual inbound support, complaint intake, deduplication and admin handoff.
CREATE TABLE IF NOT EXISTS whatsapp_inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid text NOT NULL UNIQUE,
  from_phone text NOT NULL,
  message_type text NOT NULL,
  message_text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_from_received_idx ON whatsapp_inbound_events(from_phone, received_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  preferred_language text NOT NULL DEFAULT 'te' CHECK (preferred_language IN ('te','en')),
  state text NOT NULL DEFAULT 'IDLE',
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  opted_out boolean NOT NULL DEFAULT false,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS village_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_key text NOT NULL UNIQUE,
  keywords_te text[] NOT NULL DEFAULT '{}',
  keywords_en text[] NOT NULL DEFAULT '{}',
  answer_te text NOT NULL,
  answer_en text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS village_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE,
  phone_e164 text NOT NULL,
  language text NOT NULL DEFAULT 'te',
  category text,
  ward text,
  description text,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','UNDER_REVIEW','IN_PROGRESS','RESOLVED','REJECTED')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS village_complaints_phone_idx ON village_complaints(phone_e164, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_admin_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  inbound_wamid text NOT NULL,
  reason text NOT NULL,
  message_text text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ASSIGNED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inbound_wamid)
);

CREATE TABLE IF NOT EXISTS whatsapp_monthly_usage (
  month_key text PRIMARY KEY,
  service_messages_sent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed only verified facts. Replace placeholders with approved village contact details before enabling.
INSERT INTO village_faqs(intent_key,keywords_te,keywords_en,answer_te,answer_en,approved) VALUES
('welcome', ARRAY['నమస్కారం','హాయ్','హలో','వందనం'], ARRAY['hi','hello','namaste','hey'], 'నమస్కారం! పల్లెర్లమూడి కనెక్ట్‌కు స్వాగతం. మీకు ఏ సహాయం కావాలి? గ్రామ సమాచారం, సమస్య నమోదు లేదా ఫిర్యాదు స్థితి కోసం మీ ప్రశ్న పంపండి.', 'Hello! Welcome to Pallerlamudi Connect. How can we help? Ask about village information, report an issue, or check a complaint status.', true),
('water', ARRAY['నీరు','తాగునీరు','నీటి సమస్య'], ARRAY['water','drinking water','water problem'], 'తాగునీటి సమస్య నమోదు చేయడానికి మీ వార్డు నంబర్ మరియు సమస్య ఉన్న ప్రదేశం పంపండి. అవసరమైతే ఫోటో కూడా జత చేయండి.', 'To report a drinking-water issue, send your ward number and the location. You may also attach a photo.', true),
('roads', ARRAY['రోడ్డు','రహదారి','గుంతలు'], ARRAY['road','roads','pothole','street'], 'రోడ్డు సమస్య నమోదు చేయడానికి మీ వార్డు నంబర్, ప్రదేశం మరియు సమస్య వివరాలు పంపండి. ఫోటో ఉంటే జత చేయండి.', 'To report a road issue, send your ward number, location and a short description. Attach a photo if available.', true),
('streetlight', ARRAY['వీధి దీపం','లైట్','స్ట్రీట్ లైట్'], ARRAY['streetlight','street light','light'], 'వీధి దీపం సమస్య కోసం వార్డు నంబర్, స్తంభం/ప్రదేశం వివరాలు పంపండి.', 'For a streetlight issue, send your ward number and the pole/location details.', true),
('sanitation', ARRAY['పారిశుధ్యం','చెత్త','మురుగు','డ్రైనేజీ'], ARRAY['sanitation','garbage','drainage','waste'], 'పారిశుధ్య సమస్య కోసం వార్డు నంబర్, ప్రదేశం మరియు సమస్య వివరాలు పంపండి.', 'For a sanitation issue, send your ward number, location and issue details.', true)
ON CONFLICT (intent_key) DO NOTHING;
