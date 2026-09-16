CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS leaf_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('pending','paid','failed','refunded','void')),
  purchaser_email text NOT NULL,
  leaf_count integer NOT NULL CHECK (leaf_count > 0),
  amount_total_cents integer NOT NULL CHECK (amount_total_cents > 0),
  help_allocation_cents integer NOT NULL CHECK (help_allocation_cents >= 0),
  payment_provider text,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK (amount_total_cents = leaf_count * 100),
  CHECK (help_allocation_cents = leaf_count * 50)
);

CREATE UNIQUE INDEX IF NOT EXISTS leaf_orders_payment_ref_uq
  ON leaf_orders(payment_provider, payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS leaves (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES leaf_orders(id),
  display_name varchar(40) NOT NULL,
  message varchar(120),
  colour text NOT NULL DEFAULT 'red' CHECK (colour IN ('red','orange','gold','green')),
  public_slug uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  ownership_token_hash text,
  planted_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);

CREATE INDEX IF NOT EXISTS leaves_order_idx ON leaves(order_id);

CREATE TABLE IF NOT EXISTS contest_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  draw_at timestamptz NOT NULL,
  prize_cents integer NOT NULL CHECK (prize_cents > 0),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','open','closed','drawn','cancelled')),
  sponsor_name text,
  funding_source text NOT NULL,
  rules_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (opens_at < closes_at),
  CHECK (closes_at <= draw_at)
);

CREATE INDEX IF NOT EXISTS contest_weeks_window_idx
  ON contest_weeks(opens_at, closes_at);

CREATE TABLE IF NOT EXISTS contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_week_id uuid NOT NULL REFERENCES contest_weeks(id),
  entry_method text NOT NULL CHECK (entry_method IN ('free','purchase')),
  order_id uuid REFERENCES leaf_orders(id),
  entrant_name varchar(100) NOT NULL,
  entrant_email text NOT NULL,
  entrant_identity_hash text NOT NULL,
  province varchar(40) NOT NULL,
  country char(2) NOT NULL DEFAULT 'CA',
  age_confirmed boolean NOT NULL,
  rules_version text NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  marketing_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_week_id, entrant_identity_hash)
);

CREATE INDEX IF NOT EXISTS contest_entries_week_idx
  ON contest_entries(contest_week_id, created_at);

CREATE TABLE IF NOT EXISTS assistance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','reviewing','approved','declined','paid','closed')),
  applicant_name varchar(120) NOT NULL,
  applicant_email text NOT NULL,
  province varchar(40) NOT NULL,
  request_category varchar(80) NOT NULL,
  request_summary text NOT NULL,
  requested_cents integer NOT NULL CHECK (requested_cents > 0),
  approved_cents integer CHECK (approved_cents >= 0),
  story_consent boolean NOT NULL DEFAULT false,
  story_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistance_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES assistance_cases(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  delivery_method varchar(60) NOT NULL,
  delivered_at timestamptz NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  recipient_alias varchar(80),
  public_title varchar(160),
  public_summary text,
  media_url text,
  consent_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_public OR consent_recorded_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS assistance_disbursements_public_idx
  ON assistance_disbursements(delivered_at DESC) WHERE is_public;

CREATE TABLE IF NOT EXISTS help_fund_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_type text NOT NULL
    CHECK (entry_type IN ('leaf_allocation','disbursement','correction','sponsor_topup')),
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  order_id uuid REFERENCES leaf_orders(id),
  disbursement_id uuid REFERENCES assistance_disbursements(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (entry_type = 'leaf_allocation' AND amount_cents > 0 AND order_id IS NOT NULL)
    OR (entry_type = 'disbursement' AND amount_cents < 0 AND disbursement_id IS NOT NULL)
    OR entry_type IN ('correction','sponsor_topup')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS help_fund_order_allocation_uq
  ON help_fund_ledger(order_id) WHERE entry_type = 'leaf_allocation';

CREATE UNIQUE INDEX IF NOT EXISTS help_fund_disbursement_uq
  ON help_fund_ledger(disbursement_id) WHERE entry_type = 'disbursement';

CREATE OR REPLACE FUNCTION reject_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'help_fund_ledger is append-only';
END;
$$;

DROP TRIGGER IF EXISTS help_fund_ledger_no_update ON help_fund_ledger;
CREATE TRIGGER help_fund_ledger_no_update
BEFORE UPDATE OR DELETE ON help_fund_ledger
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_type varchar(40) NOT NULL,
  actor_id text,
  event_type varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx
  ON audit_log(entity_type, entity_id, created_at DESC);

CREATE OR REPLACE VIEW public_impact_stats AS
SELECT
  (SELECT count(*) FROM leaves WHERE retired_at IS NULL) AS leaves_planted,
  COALESCE((SELECT sum(amount_cents) FROM help_fund_ledger WHERE entry_type = 'leaf_allocation'), 0) AS help_allocated_cents,
  COALESCE((SELECT -sum(amount_cents) FROM help_fund_ledger WHERE entry_type = 'disbursement'), 0) AS help_delivered_cents,
  COALESCE((SELECT sum(amount_cents) FROM help_fund_ledger), 0) AS help_balance_cents;
