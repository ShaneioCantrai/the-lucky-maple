ALTER TABLE assistance_cases
  ADD COLUMN IF NOT EXISTS applicant_privacy_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS applicant_privacy_version text,
  ADD COLUMN IF NOT EXISTS application_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS application_terms_version text;

UPDATE assistance_cases
SET applicant_privacy_acknowledged_at = COALESCE(applicant_privacy_acknowledged_at, submitted_at, created_at),
    applicant_privacy_version = COALESCE(applicant_privacy_version, 'legacy-pre-2026-09-19')
WHERE privacy_acknowledged = true
  AND applicant_privacy_acknowledged_at IS NULL;
