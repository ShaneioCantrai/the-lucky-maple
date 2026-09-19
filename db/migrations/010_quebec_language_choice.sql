ALTER TABLE applicant_accounts
  ADD COLUMN IF NOT EXISTS preferred_language varchar(8) NOT NULL DEFAULT 'en-CA';

ALTER TABLE applicant_accounts
  ADD CONSTRAINT applicant_accounts_preferred_language_check
  CHECK (preferred_language IN ('en-CA','fr-CA'));

ALTER TABLE assistance_cases
  ADD COLUMN IF NOT EXISTS contract_language varchar(8),
  ADD COLUMN IF NOT EXISTS french_version_presented boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS english_language_choice_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS language_choice_at timestamptz;

ALTER TABLE contest_entries
  ADD COLUMN IF NOT EXISTS rules_language varchar(8) NOT NULL DEFAULT 'en-CA',
  ADD COLUMN IF NOT EXISTS french_rules_presented boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS english_language_choice_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS terms_language varchar(8),
  ADD COLUMN IF NOT EXISTS french_terms_presented boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS english_language_choice_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE assistance_cases
  ADD CONSTRAINT assistance_cases_contract_language_check
  CHECK (contract_language IS NULL OR contract_language IN ('en-CA','fr-CA'));

ALTER TABLE contest_entries
  ADD CONSTRAINT contest_entries_rules_language_check
  CHECK (rules_language IN ('en-CA','fr-CA'));
ALTER TABLE contributions
  ADD CONSTRAINT contributions_terms_language_check
  CHECK (terms_language IS NULL OR terms_language IN ('en-CA','fr-CA'));

UPDATE assistance_cases
SET contract_language = COALESCE(contract_language, 'en-CA'),
    language_choice_at = COALESCE(language_choice_at, submitted_at, created_at)
WHERE contract_language IS NULL;

UPDATE contest_entries
SET french_rules_presented = false
WHERE french_rules_presented IS NULL;
