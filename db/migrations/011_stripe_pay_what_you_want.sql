ALTER TABLE leaf_orders
  DROP CONSTRAINT IF EXISTS leaf_orders_check,
  DROP CONSTRAINT IF EXISTS leaf_orders_check1;

ALTER TABLE leaf_orders
  DROP CONSTRAINT IF EXISTS leaf_orders_one_leaf_check,
  DROP CONSTRAINT IF EXISTS leaf_orders_min_amount_check,
  DROP CONSTRAINT IF EXISTS leaf_orders_help_allocation_check;

ALTER TABLE leaf_orders
  ADD CONSTRAINT leaf_orders_one_leaf_check CHECK (leaf_count = 1),
  ADD CONSTRAINT leaf_orders_min_amount_check CHECK (amount_total_cents >= 200),
  ADD CONSTRAINT leaf_orders_help_allocation_check
    CHECK (help_allocation_cents = (amount_total_cents + 1) / 2);

ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS contributions_check,
  DROP CONSTRAINT IF EXISTS contributions_gross_min_check;

ALTER TABLE contributions
  ADD CONSTRAINT contributions_gross_min_check CHECK (gross_cents >= 200);

CREATE TABLE IF NOT EXISTS stripe_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(40) NOT NULL,
  message varchar(120),
  email text NOT NULL,
  amount_prefill_cents integer NOT NULL CHECK (amount_prefill_cents >= 200),
  terms_language varchar(8) NOT NULL CHECK (terms_language IN ('en-CA','fr-CA')),
  french_terms_presented boolean NOT NULL DEFAULT false,
  english_language_choice_confirmed boolean NOT NULL DEFAULT false,
  terms_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','expired')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  order_id uuid REFERENCES leaf_orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS stripe_checkout_intents_status_idx
  ON stripe_checkout_intents(status, created_at DESC);

CREATE INDEX IF NOT EXISTS stripe_checkout_intents_session_idx
  ON stripe_checkout_intents(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
