ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS contributions_gross_cents_check;

ALTER TABLE contributions
  ALTER COLUMN leaf_count SET DEFAULT 1;

ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS message varchar(120),
  ADD COLUMN IF NOT EXISTS leaf_slot integer,
  ADD COLUMN IF NOT EXISTS sprite_variant integer;

ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS contributions_one_leaf_check;
ALTER TABLE contributions
  ADD CONSTRAINT contributions_one_leaf_check CHECK (leaf_count = 1);

ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS contributions_gross_min_check;
ALTER TABLE contributions
  ADD CONSTRAINT contributions_gross_min_check CHECK (gross_cents >= 100);

ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS contributions_leaf_slot_check;
ALTER TABLE contributions
  ADD CONSTRAINT contributions_leaf_slot_check
    CHECK (leaf_slot IS NULL OR leaf_slot BETWEEN 1 AND 965);
ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS contributions_sprite_variant_check;
ALTER TABLE contributions
  ADD CONSTRAINT contributions_sprite_variant_check
    CHECK (sprite_variant IS NULL OR sprite_variant BETWEEN 1 AND 12);

CREATE UNIQUE INDEX IF NOT EXISTS contributions_campaign_leaf_slot_uq
  ON contributions(campaign_id, leaf_slot)
  WHERE leaf_slot IS NOT NULL AND status IN ('pending','paid');

CREATE OR REPLACE VIEW public_current_campaign AS
SELECT
  c.id, c.slug, c.status, c.recipient_alias, c.city, c.province,
  c.public_title, c.public_summary, c.goal_cents,
  c.verification_status, c.activated_at, c.completed_at,
  COALESCE(sum(x.gross_cents) FILTER (WHERE x.status = 'paid'), 0)::bigint AS raised_cents,
  count(x.id) FILTER (WHERE x.status = 'paid')::bigint AS leaves_filled,
  GREATEST(c.goal_cents - COALESCE(sum(x.gross_cents) FILTER (WHERE x.status = 'paid'), 0), 0)::bigint AS remaining_cents
FROM aid_campaigns c
LEFT JOIN contributions x ON x.campaign_id = c.id
WHERE c.status = 'active'
GROUP BY c.id;
