ALTER TABLE applicant_accounts
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

UPDATE applicant_accounts
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS applicant_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES applicant_accounts(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applicant_auth_tokens_account_idx
  ON applicant_auth_tokens(account_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS applicant_auth_tokens_live_idx
  ON applicant_auth_tokens(purpose, expires_at)
  WHERE used_at IS NULL;
