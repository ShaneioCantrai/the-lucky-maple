ALTER TABLE assistance_cases
  ALTER COLUMN applicant_name DROP NOT NULL,
  ALTER COLUMN province DROP NOT NULL,
  ALTER COLUMN request_category DROP NOT NULL,
  ALTER COLUMN request_summary DROP NOT NULL,
  ALTER COLUMN requested_cents DROP NOT NULL;
