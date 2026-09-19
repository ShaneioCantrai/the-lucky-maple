CREATE TABLE IF NOT EXISTS applicant_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS applicant_accounts_email_uq
  ON applicant_accounts (lower(email));

CREATE TABLE IF NOT EXISTS applicant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES applicant_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicant_sessions_account_idx
  ON applicant_sessions(account_id, expires_at DESC);
ALTER TABLE assistance_cases
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES applicant_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city varchar(120),
  ADD COLUMN IF NOT EXISTS preferred_contact varchar(40) NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS phone varchar(40),
  ADD COLUMN IF NOT EXISTS private_story text,
  ADD COLUMN IF NOT EXISTS public_story_draft text,
  ADD COLUMN IF NOT EXISTS public_identity_preference varchar(24) NOT NULL DEFAULT 'first_name',
  ADD COLUMN IF NOT EXISTS public_alias varchar(80),
  ADD COLUMN IF NOT EXISTS open_to_public_story boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_storage_key text,
  ADD COLUMN IF NOT EXISTS photo_original_name text,
  ADD COLUMN IF NOT EXISTS photo_mime varchar(80),
  ADD COLUMN IF NOT EXISTS photo_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS eligibility_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accuracy_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE assistance_cases
  DROP CONSTRAINT IF EXISTS assistance_cases_status_check;
ALTER TABLE assistance_cases
  ADD CONSTRAINT assistance_cases_status_check
    CHECK (status IN (
      'draft','submitted','reviewing','need_more_info','shortlisted',
      'approved','published','funded','declined','paid','closed'
    ));

ALTER TABLE assistance_cases
  DROP CONSTRAINT IF EXISTS assistance_cases_public_identity_preference_check;
ALTER TABLE assistance_cases
  ADD CONSTRAINT assistance_cases_public_identity_preference_check
    CHECK (public_identity_preference IN ('full_name','first_name','pseudonym','anonymous'));

ALTER TABLE assistance_cases
  DROP CONSTRAINT IF EXISTS assistance_cases_preferred_contact_check;
ALTER TABLE assistance_cases
  ADD CONSTRAINT assistance_cases_preferred_contact_check
    CHECK (preferred_contact IN ('email','phone','either'));

CREATE UNIQUE INDEX IF NOT EXISTS assistance_cases_one_open_per_account_uq
  ON assistance_cases(account_id)
  WHERE account_id IS NOT NULL AND status NOT IN ('declined','funded','paid','closed');
CREATE TABLE IF NOT EXISTS assistance_case_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES assistance_cases(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  actor varchar(80) NOT NULL DEFAULT 'team',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistance_case_notes_case_idx
  ON assistance_case_notes(case_id, created_at DESC);

ALTER TABLE aid_campaigns
  ADD COLUMN IF NOT EXISTS assistance_case_id uuid REFERENCES assistance_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS aid_campaigns_case_idx
  ON aid_campaigns(assistance_case_id);

CREATE INDEX IF NOT EXISTS assistance_cases_review_queue_idx
  ON assistance_cases(status, submitted_at DESC NULLS LAST, created_at DESC);

UPDATE assistance_cases
SET submitted_at = COALESCE(submitted_at, created_at)
WHERE status <> 'draft' AND submitted_at IS NULL;
