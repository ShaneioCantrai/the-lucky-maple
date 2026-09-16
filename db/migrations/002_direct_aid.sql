CREATE TABLE IF NOT EXISTS aid_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','completed','cancelled')),
  recipient_alias varchar(120) NOT NULL,
  city varchar(120),
  province varchar(40) NOT NULL,
  public_title varchar(180) NOT NULL,
  public_summary text NOT NULL,
  goal_cents integer NOT NULL CHECK (goal_cents > 0),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','reviewing','verified','rejected')),
  story_consent boolean NOT NULL DEFAULT false,
  story_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  completed_at timestamptz,
  CHECK (NOT story_consent OR story_consent_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS aid_campaigns_one_active_uq
  ON aid_campaigns ((status)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES aid_campaigns(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded','void')),  donor_email text,
  display_name varchar(80),
  leaf_count integer NOT NULL CHECK (leaf_count > 0),
  gross_cents integer NOT NULL CHECK (gross_cents = leaf_count * 100),
  processor_fee_cents integer NOT NULL DEFAULT 0 CHECK (processor_fee_cents >= 0),
  recipient_cents integer NOT NULL DEFAULT 0 CHECK (recipient_cents >= 0),
  payment_provider varchar(40),
  payment_reference text,
  share_id varchar(64),
  share_channel varchar(32),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK (recipient_cents <= gross_cents)
);

CREATE UNIQUE INDEX IF NOT EXISTS contributions_payment_ref_uq
  ON contributions(payment_provider, payment_reference)
  WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS contributions_campaign_idx
  ON contributions(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contributions_share_idx
  ON contributions(share_id) WHERE share_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS share_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id uuid REFERENCES aid_campaigns(id),
  event_type text NOT NULL CHECK (event_type IN ('share_start','visit')),
  share_id varchar(64) NOT NULL,
  channel varchar(32) NOT NULL DEFAULT 'unknown',  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS share_events_campaign_idx
  ON share_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS share_events_share_idx
  ON share_events(share_id, created_at DESC);

CREATE OR REPLACE VIEW public_current_campaign AS
SELECT
  c.id, c.slug, c.status, c.recipient_alias, c.city, c.province,
  c.public_title, c.public_summary, c.goal_cents,
  c.verification_status, c.activated_at, c.completed_at,
  COALESCE(sum(x.gross_cents) FILTER (WHERE x.status = 'paid'), 0)::bigint AS raised_cents,
  COALESCE(sum(x.leaf_count) FILTER (WHERE x.status = 'paid'), 0)::bigint AS leaves_filled,
  GREATEST(c.goal_cents - COALESCE(sum(x.gross_cents) FILTER (WHERE x.status = 'paid'), 0), 0)::bigint AS remaining_cents
FROM aid_campaigns c
LEFT JOIN contributions x ON x.campaign_id = c.id
WHERE c.status = 'active'
GROUP BY c.id;

CREATE OR REPLACE VIEW public_share_stats AS
SELECT
  campaign_id,
  count(*) FILTER (WHERE event_type = 'share_start')::bigint AS share_starts,
  count(*) FILTER (WHERE event_type = 'visit')::bigint AS referred_visits
FROM share_events
GROUP BY campaign_id;
