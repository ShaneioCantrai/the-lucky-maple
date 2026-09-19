import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import { rateLimit } from 'express-rate-limit';
import { pool, dbHealth, withTransaction } from './db.js';
import { emailDeliveryConfigured, sendPasswordChangedEmail, sendPasswordResetEmail, sendVerificationEmail } from './mailer.js';
import { applicantCredentialsSchema, applicantEmailSchema, contestEntrySchema, helpApplicationDraftSchema, helpApplicationSchema, mockPurchaseSchema, passwordResetSchema } from './schemas.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const bindAddress = process.env.BIND_ADDRESS || '0.0.0.0';
const rulesVersion = process.env.RULES_VERSION || 'prototype-0.1';
const identitySecret = process.env.IDENTITY_HASH_SECRET || 'development-only-change-me';
const applicantCookie = 'maplewish_applicant';
const applicantSessionDays = Math.max(1, Number(process.env.APPLICANT_SESSION_DAYS || 30));
const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
const privateUploadDir = process.env.PRIVATE_UPLOAD_DIR || '/var/lib/maplewish/private-uploads';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

if (process.env.NODE_ENV === 'production' && identitySecret === 'development-only-change-me') {
  throw new Error('IDENTITY_HASH_SECRET must be set in production');
}

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));
app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(repoRoot, 'index.html')));
app.get('/rules.html', (_req, res) => res.sendFile(path.join(repoRoot, 'rules.html')));
app.get('/apply.html', (_req, res) => res.sendFile(path.join(repoRoot, 'apply.html')));
app.get('/reset-password.html', (_req, res) => res.sendFile(path.join(repoRoot, 'reset-password.html')));
app.get('/app.js', (_req, res) => res.sendFile(path.join(repoRoot, 'app.js')));
app.get('/apply.js', (_req, res) => res.sendFile(path.join(repoRoot, 'apply.js')));
app.get('/reset-password.js', (_req, res) => res.sendFile(path.join(repoRoot, 'reset-password.js')));
app.get('/leaf-layout.js', (_req, res) => res.sendFile(path.join(repoRoot, 'leaf-layout.js')));
app.get('/styles.css', (_req, res) => res.sendFile(path.join(repoRoot, 'styles.css')));
app.use('/img/web', express.static(path.join(repoRoot, 'img', 'web'), { maxAge: '1h', immutable: false }));

function identityHash(email) {
  return crypto.createHmac('sha256', identitySecret)
    .update(email.trim().toLowerCase())
    .digest('hex');
}

function parseCookies(req) {
  const out = {};
  for (const pair of String(req.headers.cookie || '').split(';')) {
    const index = pair.indexOf('=');
    if (index < 1) continue;
    out[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return out;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function derivePassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

async function makePasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = await derivePassword(password, salt);
  return { salt, hash: hash.toString('base64url') };
}

async function passwordMatches(password, salt, expected) {
  const actual = await derivePassword(password, salt);
  const wanted = Buffer.from(expected, 'base64url');
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

function setApplicantCookie(res, token, expiresAt) {
  res.cookie(applicantCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

async function createApplicantSession(accountId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + applicantSessionDays * 86400000);
  await pool.query(`INSERT INTO applicant_sessions (account_id,token_hash,expires_at)
    VALUES ($1,$2,$3)`, [accountId, sha256(token), expiresAt]);
  setApplicantCookie(res, token, expiresAt);
}

async function requireApplicant(req, res, next) {
  try {
    const token = parseCookies(req)[applicantCookie];
    if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
    const result = await pool.query(`SELECT s.id AS session_id,s.account_id,a.email,a.email_verified_at
      FROM applicant_sessions s JOIN applicant_accounts a ON a.id=s.account_id
      WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1`, [sha256(token)]);
    if (!result.rows[0]) {
      res.clearCookie(applicantCookie, { path: '/' });
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    req.applicant = result.rows[0];
    await pool.query('UPDATE applicant_sessions SET last_seen_at=now() WHERE id=$1', [req.applicant.session_id]);
    next();
  } catch (error) { next(error); }
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.get('host')) return next();
  } catch {}
  return res.status(403).json({ error: 'Cross-site request rejected.' });
}

const applicantAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const applicantEmailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8 });

async function issueApplicantAuthToken(accountId, purpose, ttlMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMs);
  await withTransaction(async client => {
    await client.query(`UPDATE applicant_auth_tokens SET used_at=COALESCE(used_at,now())
      WHERE account_id=$1 AND purpose=$2 AND used_at IS NULL`, [accountId, purpose]);
    await client.query(`INSERT INTO applicant_auth_tokens(account_id,purpose,token_hash,expires_at)
      VALUES ($1,$2,$3,$4)`, [accountId, purpose, sha256(token), expiresAt]);
  });
  return token;
}

async function sendApplicantVerification(accountId, email) {
  const token = await issueApplicantAuthToken(accountId, 'verify_email', 24 * 60 * 60 * 1000);
  await sendVerificationEmail(email, token);
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype));
  },
});

app.get('/api/health', async (_req, res, next) => {
  try {
    const db = await dbHealth();
    res.json({ ok: true, service: 'the-lucky-maple', dbTime: db.now });
  } catch (error) { next(error); }
});

app.get('/api/stats', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM public_impact_stats');
    const row = result.rows[0];
    res.json({
      leavesPlanted: Number(row.leaves_planted),
      helpAllocatedCents: Number(row.help_allocated_cents),
      helpDeliveredCents: Number(row.help_delivered_cents),
      helpBalanceCents: Number(row.help_balance_cents),
    });
  } catch (error) { next(error); }
});

app.get('/api/campaign/current', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM public_current_campaign LIMIT 1');
    res.json({ campaign: result.rows[0] || null });
  } catch (error) { next(error); }
});

app.get('/api/campaign/leaves', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT x.id, x.display_name, x.message, x.gross_cents,
             x.leaf_slot, x.sprite_variant, x.paid_at
      FROM contributions x
      JOIN aid_campaigns c ON c.id = x.campaign_id
      WHERE c.status = 'active' AND x.status = 'paid' AND x.leaf_slot IS NOT NULL
      ORDER BY x.leaf_slot ASC`);
    res.json({ leaves: result.rows });
  } catch (error) { next(error); }
});

app.post('/api/share-events', async (req, res, next) => {
  try {
    const eventType = String(req.body?.eventType || '');
    const shareId = String(req.body?.shareId || '').trim();
    const channel = String(req.body?.channel || 'unknown').trim().slice(0, 32);
    if (!['share_start','visit'].includes(eventType) || !/^[a-zA-Z0-9_-]{6,64}$/.test(shareId)) {
      return res.status(400).json({ error: 'Invalid share event.' });
    }
    const campaign = await pool.query(`SELECT id FROM aid_campaigns WHERE status='active' LIMIT 1`);
    await pool.query(`INSERT INTO share_events (campaign_id,event_type,share_id,channel)
      VALUES ($1,$2,$3,$4)`, [campaign.rows[0]?.id || null, eventType, shareId, channel || 'unknown']);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/leaves', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 2000), 5000);
    const result = await pool.query(
      `SELECT id, display_name, message, colour, public_slug, planted_at
       FROM leaves WHERE retired_at IS NULL ORDER BY id ASC LIMIT $1`, [limit]);
    res.json({ leaves: result.rows });
  } catch (error) { next(error); }
});

app.get('/api/contest/current', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, label, opens_at, closes_at, draw_at, prize_cents,
              sponsor_name, funding_source, rules_version
       FROM contest_weeks
       WHERE status = 'open' AND now() >= opens_at AND now() < closes_at
       ORDER BY opens_at DESC LIMIT 1`);
    res.json({ contest: result.rows[0] || null });
  } catch (error) { next(error); }
});

app.post('/api/contest/entries', async (req, res, next) => {
  try {
    const entry = contestEntrySchema.parse(req.body);
    const contest = await pool.query(
      `SELECT id, rules_version FROM contest_weeks
       WHERE status = 'open' AND now() >= opens_at AND now() < closes_at
       ORDER BY opens_at DESC LIMIT 1`);
    if (!contest.rows[0]) return res.status(409).json({ error: 'No giveaway is currently open.' });
    const week = contest.rows[0];
    const hash = identityHash(entry.email);
    const result = await pool.query(
      `INSERT INTO contest_entries
       (contest_week_id, entry_method, entrant_name, entrant_email,
        entrant_identity_hash, province, country, age_confirmed, rules_version,
        marketing_consent, marketing_consent_at)
       VALUES ($1,'free',$2,$3,$4,$5,'CA',true,$6,$7,CASE WHEN $7 THEN now() END)
       ON CONFLICT (contest_week_id, entrant_identity_hash) DO NOTHING
       RETURNING id`,
      [week.id, entry.name, entry.email.toLowerCase(), hash, entry.province,
       week.rules_version, entry.marketingConsent]);
    res.status(result.rows[0] ? 201 : 200).json({ entered: true, alreadyEntered: !result.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/impact', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT recipient_alias, public_title, public_summary, media_url,
              amount_cents, delivered_at
       FROM assistance_disbursements
       WHERE is_public = true
       ORDER BY delivered_at DESC LIMIT 50`);
    res.json({ stories: result.rows });
  } catch (error) { next(error); }
});

function applicationsOpen() {
  return process.env.ENABLE_HELP_APPLICATIONS === 'true';
}

async function applicantApplication(accountId) {
  const result = await pool.query(`SELECT id,status,applicant_name,province,city,preferred_contact,phone,
    request_category,request_summary,requested_cents,private_story,public_story_draft,
    public_identity_preference,public_alias,open_to_public_story,eligibility_confirmed,
    accuracy_confirmed,privacy_acknowledged,submitted_at,updated_at,created_at,
    (photo_storage_key IS NOT NULL) AS has_photo
    FROM assistance_cases WHERE account_id=$1
    ORDER BY created_at DESC LIMIT 1`, [accountId]);
  return result.rows[0] || null;
}

app.get('/api/help/auth/capabilities', (_req, res) => {
  res.json({
    emailDeliveryAvailable: emailDeliveryConfigured(),
    verificationRequired: requireEmailVerification,
  });
});

app.post('/api/help/auth/register', applicantAuthLimiter, requireSameOrigin, async (req, res, next) => {
  try {
    if (!applicationsOpen()) return res.status(503).json({ error: 'Applications are not open yet.' });
    if (requireEmailVerification && !emailDeliveryConfigured()) {
      return res.status(503).json({ error: 'Email verification is temporarily unavailable.' });
    }
    const credentials = applicantCredentialsSchema.parse(req.body);
    const record = await makePasswordRecord(credentials.password);
    let account;
    try {
      const result = await pool.query(`INSERT INTO applicant_accounts
        (email,password_salt,password_hash,last_login_at,email_verified_at)
        VALUES ($1,$2,$3,now(),NULL) RETURNING id,email,email_verified_at`,
        [credentials.email.toLowerCase(), record.salt, record.hash]);
      account = result.rows[0];
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'An account already exists for that email.' });
      throw error;
    }
    await createApplicantSession(account.id, res);
    await pool.query(`INSERT INTO audit_log(actor_type,actor_id,event_type,entity_type,entity_id)
      VALUES ('applicant',$1,'applicant_registered','applicant_account',$1)`, [account.id]);

    let verificationEmailSent = false;
    if (emailDeliveryConfigured()) {
      try {
        await sendApplicantVerification(account.id, account.email);
        verificationEmailSent = true;
      } catch (error) {
        console.error('Verification email failed:', error.message);
      }
    }

    res.status(201).json({
      signedIn: true,
      email: account.email,
      emailVerified: false,
      emailDeliveryAvailable: emailDeliveryConfigured(),
      verificationRequired: requireEmailVerification,
      verificationEmailSent,
      application: null,
    });
  } catch (error) { next(error); }
});

app.post('/api/help/auth/login', applicantAuthLimiter, requireSameOrigin, async (req, res, next) => {
  try {
    const credentials = applicantCredentialsSchema.parse(req.body);
    const result = await pool.query(`SELECT id,email,password_salt,password_hash,email_verified_at
      FROM applicant_accounts WHERE lower(email)=lower($1) LIMIT 1`, [credentials.email]);
    const account = result.rows[0];
    if (!account) {
      await derivePassword(credentials.password, 'maplewish-invalid-account');
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    if (!(await passwordMatches(credentials.password, account.password_salt, account.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    await pool.query('DELETE FROM applicant_sessions WHERE expires_at<=now()');
    await pool.query('UPDATE applicant_accounts SET last_login_at=now() WHERE id=$1', [account.id]);
    await createApplicantSession(account.id, res);
    res.json({
      signedIn: true,
      email: account.email,
      emailVerified: Boolean(account.email_verified_at),
      emailDeliveryAvailable: emailDeliveryConfigured(),
      verificationRequired: requireEmailVerification,
      application: await applicantApplication(account.id),
    });
  } catch (error) { next(error); }
});

app.post('/api/help/auth/logout', requireSameOrigin, async (req, res, next) => {
  try {
    const token = parseCookies(req)[applicantCookie];
    if (token) await pool.query('DELETE FROM applicant_sessions WHERE token_hash=$1', [sha256(token)]);
    res.clearCookie(applicantCookie, { path: '/' });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/help/auth/verify-email', applicantEmailLimiter, async (req, res, next) => {
  try {
    const token = String(req.query.token || '');
    if (token.length < 32 || token.length > 200) return res.redirect(303, '/apply.html?verified=0');
    const verified = await withTransaction(async client => {
      const result = await client.query(`SELECT t.id,t.account_id,t.used_at,t.expires_at,a.email_verified_at
        FROM applicant_auth_tokens t JOIN applicant_accounts a ON a.id=t.account_id
        WHERE t.token_hash=$1 AND t.purpose='verify_email' FOR UPDATE`, [sha256(token)]);
      const row = result.rows[0];
      if (!row) return false;
      if (row.email_verified_at) return true;
      if (row.used_at || new Date(row.expires_at).getTime() <= Date.now()) return false;
      await client.query('UPDATE applicant_accounts SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1', [row.account_id]);
      await client.query(`UPDATE applicant_auth_tokens SET used_at=COALESCE(used_at,now())
        WHERE account_id=$1 AND purpose='verify_email' AND used_at IS NULL`, [row.account_id]);
      await client.query(`INSERT INTO audit_log(actor_type,actor_id,event_type,entity_type,entity_id)
        VALUES ('applicant',$1,'email_verified','applicant_account',$1)`, [row.account_id]);
      return true;
    });
    return res.redirect(303, verified ? '/apply.html?verified=1' : '/apply.html?verified=0');
  } catch (error) { next(error); }
});

app.post('/api/help/auth/resend-verification', applicantEmailLimiter, requireApplicant, requireSameOrigin, async (req, res, next) => {
  try {
    if (req.applicant.email_verified_at) return res.json({ sent: false, alreadyVerified: true });
    if (!emailDeliveryConfigured()) return res.status(503).json({ error: 'Verification email delivery is not configured yet.' });
    await sendApplicantVerification(req.applicant.account_id, req.applicant.email);
    await pool.query(`INSERT INTO audit_log(actor_type,actor_id,event_type,entity_type,entity_id)
      VALUES ('applicant',$1,'verification_email_resent','applicant_account',$1)`, [req.applicant.account_id]);
    res.json({ sent: true });
  } catch (error) { next(error); }
});

app.post('/api/help/auth/forgot-password', applicantEmailLimiter, requireSameOrigin, async (req, res, next) => {
  try {
    if (!emailDeliveryConfigured()) return res.status(503).json({ error: 'Password recovery email delivery is not configured yet.' });
    const request = applicantEmailSchema.parse(req.body);
    const result = await pool.query('SELECT id,email FROM applicant_accounts WHERE lower(email)=lower($1) LIMIT 1', [request.email]);
    const account = result.rows[0];
    if (account) {
      const token = await issueApplicantAuthToken(account.id, 'password_reset', 60 * 60 * 1000);
      try {
        await sendPasswordResetEmail(account.email, token);
      } catch (error) {
        console.error('Password reset email failed:', error.message);
      }
    }
    res.status(202).json({ accepted: true, message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (error) { next(error); }
});

app.post('/api/help/auth/reset-password', applicantEmailLimiter, requireSameOrigin, async (req, res, next) => {
  try {
    const request = passwordResetSchema.parse(req.body);
    const record = await makePasswordRecord(request.password);
    const account = await withTransaction(async client => {
      const result = await client.query(`SELECT t.id,t.account_id,a.email
        FROM applicant_auth_tokens t JOIN applicant_accounts a ON a.id=t.account_id
        WHERE t.token_hash=$1 AND t.purpose='password_reset' AND t.used_at IS NULL
          AND t.expires_at>now() FOR UPDATE`, [sha256(request.token)]);
      const row = result.rows[0];
      if (!row) return null;
      await client.query(`UPDATE applicant_accounts SET password_salt=$1,password_hash=$2,
        password_changed_at=now() WHERE id=$3`, [record.salt, record.hash, row.account_id]);
      await client.query(`UPDATE applicant_auth_tokens SET used_at=COALESCE(used_at,now())
        WHERE account_id=$1 AND purpose='password_reset' AND used_at IS NULL`, [row.account_id]);
      await client.query('DELETE FROM applicant_sessions WHERE account_id=$1', [row.account_id]);
      await client.query(`INSERT INTO audit_log(actor_type,actor_id,event_type,entity_type,entity_id)
        VALUES ('applicant',$1,'password_reset_completed','applicant_account',$1)`, [row.account_id]);
      return row;
    });
    if (!account) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    if (emailDeliveryConfigured()) {
      sendPasswordChangedEmail(account.email).catch(error => console.error('Password-change email failed:', error.message));
    }
    res.json({ reset: true });
  } catch (error) { next(error); }
});

app.get('/api/help/me', requireApplicant, async (req, res, next) => {
  try {
    res.json({
      email: req.applicant.email,
      emailVerified: Boolean(req.applicant.email_verified_at),
      emailDeliveryAvailable: emailDeliveryConfigured(),
      verificationRequired: requireEmailVerification,
      applicationsOpen: applicationsOpen(),
      application: await applicantApplication(req.applicant.account_id),
    });
  } catch (error) { next(error); }
});

app.put('/api/help/application', requireApplicant, requireSameOrigin, async (req, res, next) => {
  try {
    if (!applicationsOpen()) return res.status(503).json({ error: 'Applications are not open yet.' });
    const item = helpApplicationDraftSchema.parse(req.body);
    const existing = await applicantApplication(req.applicant.account_id);
    if (existing && !['draft','submitted','need_more_info'].includes(existing.status)) {
      return res.status(409).json({ error: 'This application is being reviewed and cannot be edited right now.' });
    }

    const values = [
      item.name || null, req.applicant.email.toLowerCase(), item.province || null, item.city || null,
      item.preferredContact, item.phone || null, item.category || null, item.summary || null,
      item.requestedCents || null, item.privateStory || null, item.publicStoryDraft || null,
      item.publicIdentityPreference, item.publicAlias || null, item.openToPublicStory,
      item.eligibilityConfirmed, item.accuracyConfirmed, item.privacyAcknowledged,
      req.applicant.account_id,
    ];

    if (existing) {
      await pool.query(`UPDATE assistance_cases SET
        applicant_name=$1,applicant_email=$2,province=$3,city=$4,preferred_contact=$5,phone=$6,
        request_category=$7,request_summary=$8,requested_cents=$9,private_story=$10,
        public_story_draft=$11,public_identity_preference=$12,public_alias=$13,
        open_to_public_story=$14,eligibility_confirmed=$15,accuracy_confirmed=$16,
        privacy_acknowledged=$17,updated_at=now()
        WHERE id=$18`, [...values.slice(0,17), existing.id]);
    } else {
      await pool.query(`INSERT INTO assistance_cases
        (status,applicant_name,applicant_email,province,city,preferred_contact,phone,
         request_category,request_summary,requested_cents,private_story,public_story_draft,
         public_identity_preference,public_alias,open_to_public_story,eligibility_confirmed,
         accuracy_confirmed,privacy_acknowledged,account_id)
        VALUES ('draft',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, values);
    }
    res.json({ saved: true, application: await applicantApplication(req.applicant.account_id) });
  } catch (error) { next(error); }
});

app.post('/api/help/application/submit', requireApplicant, requireSameOrigin, async (req, res, next) => {
  try {
    if (requireEmailVerification && !req.applicant.email_verified_at) {
      return res.status(403).json({ error: 'Verify your email before submitting your application.' });
    }
    const current = await applicantApplication(req.applicant.account_id);
    if (!current) return res.status(409).json({ error: 'Save your application before submitting it.' });
    if (!['draft','submitted','need_more_info'].includes(current.status)) {
      return res.status(409).json({ error: 'This application is already in review.' });
    }
    const complete = helpApplicationSchema.parse({
      name: current.applicant_name || '',
      province: current.province || '',
      city: current.city || '',
      preferredContact: current.preferred_contact || 'email',
      phone: current.phone || '',
      category: current.request_category || '',
      summary: current.request_summary || '',
      privateStory: current.private_story || '',
      publicStoryDraft: current.public_story_draft || '',
      publicIdentityPreference: current.public_identity_preference || 'first_name',
      publicAlias: current.public_alias || '',
      requestedCents: Number(current.requested_cents || 0),
      openToPublicStory: Boolean(current.open_to_public_story),
      eligibilityConfirmed: Boolean(current.eligibility_confirmed),
      accuracyConfirmed: Boolean(current.accuracy_confirmed),
      privacyAcknowledged: Boolean(current.privacy_acknowledged),
    });
    if ((complete.preferredContact === 'phone' || complete.preferredContact === 'either') && complete.phone.length < 7) {
      return res.status(400).json({ error: 'Add a phone number for the contact method you selected.' });
    }
    if (complete.publicIdentityPreference === 'pseudonym' && complete.publicAlias.length < 2) {
      return res.status(400).json({ error: 'Add the pseudonym you would want us to use.' });
    }
    if (!complete.eligibilityConfirmed || !complete.accuracyConfirmed || !complete.privacyAcknowledged) {
      return res.status(400).json({ error: 'Please complete the required confirmations before submitting.' });
    }
    await pool.query(`UPDATE assistance_cases SET status='submitted',
      submitted_at=COALESCE(submitted_at,now()),updated_at=now() WHERE id=$1`, [current.id]);
    await pool.query(`INSERT INTO audit_log(actor_type,actor_id,event_type,entity_type,entity_id)
      VALUES ('applicant',$1,'help_application_submitted','assistance_case',$2)`,
      [req.applicant.account_id, current.id]);
    res.json({ submitted: true, application: await applicantApplication(req.applicant.account_id) });
  } catch (error) { next(error); }
});

app.post('/api/help/application/photo', requireApplicant, requireSameOrigin, photoUpload.single('photo'), async (req, res, next) => {
  try {
    const current = await applicantApplication(req.applicant.account_id);
    if (!current) return res.status(409).json({ error: 'Save your application before adding a photo.' });
    if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG, or WebP image up to 6 MB.' });
    if (!['draft','submitted','need_more_info'].includes(current.status)) {
      return res.status(409).json({ error: 'This application is being reviewed and its photo cannot be changed right now.' });
    }
    await fs.mkdir(privateUploadDir, { recursive: true, mode: 0o700 });
    const key = `${crypto.randomUUID()}.webp`;
    const destination = path.join(privateUploadDir, key);
    await sharp(req.file.buffer).rotate().resize({
      width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true,
    }).webp({ quality: 84 }).toFile(destination);
    const prior = await pool.query('SELECT photo_storage_key FROM assistance_cases WHERE id=$1', [current.id]);
    await pool.query(`UPDATE assistance_cases SET photo_storage_key=$1,photo_original_name=$2,
      photo_mime='image/webp',photo_uploaded_at=now(),updated_at=now() WHERE id=$3`,
      [key, req.file.originalname.slice(0, 200), current.id]);
    const oldKey = prior.rows[0]?.photo_storage_key;
    if (oldKey && oldKey !== key) await fs.unlink(path.join(privateUploadDir, oldKey)).catch(() => {});
    res.json({ uploaded: true, application: await applicantApplication(req.applicant.account_id) });
  } catch (error) { next(error); }
});

app.get('/api/help/application/photo', requireApplicant, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT photo_storage_key FROM assistance_cases WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1', [req.applicant.account_id]);
    const key = result.rows[0]?.photo_storage_key;
    if (!key) return res.status(404).end();
    res.set('Cache-Control', 'private, no-store');
    res.type('image/webp').sendFile(path.join(privateUploadDir, key));
  } catch (error) { next(error); }
});

app.delete('/api/help/application/photo', requireApplicant, requireSameOrigin, async (req, res, next) => {
  try {
    const current = await applicantApplication(req.applicant.account_id);
    if (!current) return res.status(404).end();
    if (!['draft','submitted','need_more_info'].includes(current.status)) {
      return res.status(409).json({ error: 'This application is being reviewed and its photo cannot be changed right now.' });
    }
    const prior = await pool.query('SELECT photo_storage_key FROM assistance_cases WHERE id=$1', [current.id]);
    await pool.query(`UPDATE assistance_cases SET photo_storage_key=NULL,photo_original_name=NULL,
      photo_mime=NULL,photo_uploaded_at=NULL,updated_at=now() WHERE id=$1`, [current.id]);
    const oldKey = prior.rows[0]?.photo_storage_key;
    if (oldKey) await fs.unlink(path.join(privateUploadDir, oldKey)).catch(() => {});
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/dev/mock-purchase', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_MOCK_PURCHASES !== 'true') {
      return res.status(404).end();
    }
    const purchase = mockPurchaseSchema.parse(req.body);
    const result = await withTransaction(async client => {
      const count = purchase.leaves.length;
      const orderResult = await client.query(
        `INSERT INTO leaf_orders
         (status, purchaser_email, leaf_count, amount_total_cents,
          help_allocation_cents, payment_provider, payment_reference, paid_at)
         VALUES ('paid',$1,$2,$3,$4,'mock',$5,now()) RETURNING id`,
        [purchase.email.toLowerCase(), count, count * 100, count * 50,
         `mock-${crypto.randomUUID()}`]);
      const orderId = orderResult.rows[0].id;
      const planted = [];
      for (const leaf of purchase.leaves) {
        const inserted = await client.query(
          `INSERT INTO leaves (order_id, display_name, message, colour)
           VALUES ($1,$2,$3,$4) RETURNING id, public_slug`,
          [orderId, leaf.displayName, leaf.message || null, leaf.colour]);
        planted.push(inserted.rows[0]);
      }
      await client.query(
        `INSERT INTO help_fund_ledger (entry_type, amount_cents, order_id, note)
         VALUES ('leaf_allocation',$1,$2,$3)`,
        [count * 50, orderId, `50 cents allocated for each of ${count} mock leaf purchases`]);
      return { orderId, planted, helpAllocatedCents: count * 50 };
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  if (error?.name === 'ZodError') {
    return res.status(400).json({ error: 'Invalid request.', details: error.issues });
  }
  console.error(error);
  res.status(500).json({ error: 'Internal server error.' });
});

const server = app.listen(port, bindAddress, () => {
  console.log(`MapleWish listening on ${bindAddress}:${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
