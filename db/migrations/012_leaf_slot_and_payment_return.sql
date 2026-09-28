ALTER TABLE leaves
  ADD COLUMN IF NOT EXISTS leaf_slot integer;

ALTER TABLE leaves
  DROP CONSTRAINT IF EXISTS leaves_leaf_slot_check;
ALTER TABLE leaves
  ADD CONSTRAINT leaves_leaf_slot_check
    CHECK (leaf_slot IS NULL OR leaf_slot BETWEEN 1 AND 965);

CREATE UNIQUE INDEX IF NOT EXISTS leaves_leaf_slot_active_uq
  ON leaves(leaf_slot)
  WHERE leaf_slot IS NOT NULL AND retired_at IS NULL;

ALTER TABLE stripe_checkout_intents
  ADD COLUMN IF NOT EXISTS selected_leaf_slot integer;

ALTER TABLE stripe_checkout_intents
  DROP CONSTRAINT IF EXISTS stripe_checkout_intents_selected_leaf_slot_check;
ALTER TABLE stripe_checkout_intents
  ADD CONSTRAINT stripe_checkout_intents_selected_leaf_slot_check
    CHECK (selected_leaf_slot IS NULL OR selected_leaf_slot BETWEEN 1 AND 965);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_checkout_intents_selected_leaf_slot_uq
  ON stripe_checkout_intents(selected_leaf_slot)
  WHERE selected_leaf_slot IS NOT NULL AND status IN ('pending','paid');

CREATE OR REPLACE VIEW public_impact_stats AS
SELECT
  (SELECT count(*) FROM leaves WHERE retired_at IS NULL) AS leaves_planted,
  COALESCE((
    SELECT sum(l.amount_cents)
      FROM help_fund_ledger l
     WHERE l.entry_type='leaf_allocation'
       AND NOT EXISTS (SELECT 1 FROM help_fund_ledger_voids v WHERE v.ledger_id=l.id)
  ), 0)::bigint AS help_allocated_cents,
  COALESCE((
    SELECT -sum(l.amount_cents)
      FROM help_fund_ledger l
     WHERE l.entry_type='disbursement'
       AND NOT EXISTS (SELECT 1 FROM help_fund_ledger_voids v WHERE v.ledger_id=l.id)
  ), 0)::bigint AS help_delivered_cents,
  COALESCE((
    SELECT sum(l.amount_cents)
      FROM help_fund_ledger l
     WHERE NOT EXISTS (SELECT 1 FROM help_fund_ledger_voids v WHERE v.ledger_id=l.id)
  ), 0)::bigint AS help_balance_cents,
  COALESCE((
    SELECT sum(o.amount_total_cents)
      FROM leaf_orders o
     WHERE o.status='paid'
  ), 0)::bigint AS gross_paid_cents;
