CREATE TABLE IF NOT EXISTS help_fund_ledger_voids (
  ledger_id bigint PRIMARY KEY REFERENCES help_fund_ledger(id),
  reason text NOT NULL,
  voided_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO help_fund_ledger_voids (ledger_id, reason)
SELECT id, 'Pre-launch placeholder amount was not a real transaction.'
FROM help_fund_ledger
WHERE note IN (
  'Opening balance for founder-funded direct help delivered before public launch.',
  'Historical direct help already delivered before public launch.'
)
ON CONFLICT (ledger_id) DO NOTHING;

CREATE OR REPLACE VIEW public_impact_stats AS
SELECT
  (SELECT count(*) FROM leaves WHERE retired_at IS NULL) AS leaves_planted,
  COALESCE((SELECT sum(l.amount_cents) FROM help_fund_ledger l
    WHERE l.entry_type = 'leaf_allocation'
      AND NOT EXISTS (SELECT 1 FROM help_fund_ledger_voids v WHERE v.ledger_id = l.id)), 0) AS help_allocated_cents,  COALESCE((SELECT -sum(l.amount_cents) FROM help_fund_ledger l
    WHERE l.entry_type = 'disbursement'
      AND NOT EXISTS (SELECT 1 FROM help_fund_ledger_voids v WHERE v.ledger_id = l.id)), 0) AS help_delivered_cents,
  COALESCE((SELECT sum(l.amount_cents) FROM help_fund_ledger l
    WHERE NOT EXISTS (SELECT 1 FROM help_fund_ledger_voids v WHERE v.ledger_id = l.id)), 0) AS help_balance_cents;
