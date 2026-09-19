# Applicant email verification and password recovery

MapleWish applicant accounts support email verification and password reset links.

## Required production mail settings

Set these in the private service environment, never in Git:

- `PUBLIC_BASE_URL=https://maplewish.ca`
- `MAIL_FROM=MapleWish <no-reply@maplewish.ca>`
- `SMTP_HOST=<provider SMTP host>`
- `SMTP_PORT=465` (or the provider's submission port)
- `SMTP_SECURE=true` for implicit TLS on 465
- `SMTP_USER=<SMTP username>`
- `SMTP_PASSWORD=<SMTP password or app password>`
- Optional: `SMTP_TLS_SERVERNAME=<certificate hostname>`

Once delivery is tested, set `REQUIRE_EMAIL_VERIFICATION=true`.
## Security behaviour

- Verification and reset tokens are 256-bit random values.
- Only SHA-256 token hashes are stored in PostgreSQL.
- Verification links expire after 24 hours.
- Password-reset links expire after 1 hour and are single-use.
- Completing a password reset invalidates every applicant session.
- Passwords continue to use salted scrypt hashes.
- Existing applicant accounts at migration time are grandfathered as verified.
- Recovery requests do not disclose whether an email address has an account.
- Verification/resend/reset routes are rate limited.
- Password-change notifications are sent when mail delivery is available.

If SMTP is not configured, account creation remains available while
`REQUIRE_EMAIL_VERIFICATION=false`, but automated recovery is intentionally unavailable.
