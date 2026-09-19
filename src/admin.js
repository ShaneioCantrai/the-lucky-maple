import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { pool, withTransaction } from './db.js';

const app = express();
const port = Number(process.env.ADMIN_PORT || 8900);
const bind = process.env.ADMIN_BIND || '127.0.0.1';
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const privateUploadDir = process.env.PRIVATE_UPLOAD_DIR || '/var/lib/maplewish/private-uploads';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

if (!adminPassword) throw new Error('ADMIN_PASSWORD is required');

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const split = decoded.indexOf(':');
    const user = split >= 0 ? decoded.slice(0, split) : '';
    const pass = split >= 0 ? decoded.slice(split + 1) : '';
    if (safeEqual(user, adminUser) && safeEqual(pass, adminPassword)) return next();
  }  res.set('WWW-Authenticate', 'Basic realm="MapleWish Admin"');
  res.status(401).send('Authentication required.');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(requireAdmin);
app.use(express.json({ limit: '64kb' }));
app.get('/', (_req, res) => res.sendFile(path.join(repoRoot, 'admin', 'index.html')));
app.get('/admin.css', (_req, res) => res.sendFile(path.join(repoRoot, 'admin', 'admin.css')));
app.get('/admin.js', (_req, res) => res.sendFile(path.join(repoRoot, 'admin', 'admin.js')));

app.get('/api/overview', async (_req, res, next) => {
  try {
    const [current, shares, money, cases] = await Promise.all([
      pool.query('SELECT * FROM public_current_campaign LIMIT 1'),
      pool.query(`SELECT
        count(*) FILTER (WHERE event_type='share_start') AS share_starts,
        count(*) FILTER (WHERE event_type='visit') AS referred_visits
        FROM share_events WHERE created_at >= current_date`),
      pool.query(`SELECT
        count(*) FILTER (WHERE status='paid') AS paid_count,
        COALESCE(sum(gross_cents) FILTER (WHERE status='paid'),0) AS gross_cents,
        COALESCE(sum(recipient_cents) FILTER (WHERE status='paid'),0) AS recipient_cents
        FROM contributions WHERE created_at >= current_date`),
      pool.query(`SELECT count(*) AS open_cases FROM assistance_cases
        WHERE status IN ('submitted','reviewing','need_more_info','shortlisted','approved')`),
    ]);
    res.json({ current: current.rows[0] || null, today: {
      shareStarts: Number(shares.rows[0].share_starts),
      referredVisits: Number(shares.rows[0].referred_visits),
      paidContributions: Number(money.rows[0].paid_count),
      grossCents: Number(money.rows[0].gross_cents),
      recipientCents: Number(money.rows[0].recipient_cents),
      openCases: Number(cases.rows[0].open_cases),
    }});
  } catch (error) { next(error); }
});
app.get('/api/campaigns', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        COALESCE(sum(x.gross_cents) FILTER (WHERE x.status='paid'),0)::bigint AS raised_cents,
        COALESCE(sum(x.leaf_count) FILTER (WHERE x.status='paid'),0)::bigint AS leaves_filled
      FROM aid_campaigns c
      LEFT JOIN contributions x ON x.campaign_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`);
    res.json({ campaigns: result.rows });
  } catch (error) { next(error); }
});

app.post('/api/campaigns', async (req, res, next) => {
  try {
    const body = req.body || {};
    const goalCents = Number(body.goalCents);
    if (!body.slug || !body.recipientAlias || !body.province || !body.title || !body.summary || !Number.isInteger(goalCents) || goalCents <= 0) {
      return res.status(400).json({ error: 'slug, recipientAlias, province, title, summary and positive goalCents are required.' });
    }
    const result = await pool.query(`
      INSERT INTO aid_campaigns
      (slug, recipient_alias, city, province, public_title, public_summary, goal_cents,
       verification_status, story_consent, story_consent_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9 THEN now() END)
      RETURNING *`, [
        String(body.slug).trim().toLowerCase(), String(body.recipientAlias).trim(),
        body.city ? String(body.city).trim() : null, String(body.province).trim(),
        String(body.title).trim(), String(body.summary).trim(), goalCents,
        body.verified ? 'verified' : 'unverified', Boolean(body.storyConsent)
      ]);
    res.status(201).json({ campaign: result.rows[0] });
  } catch (error) { next(error); }
});
app.post('/api/campaigns/:id/verify', async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE aid_campaigns SET verification_status='verified'
      WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found.' });
    res.json({ campaign: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/campaigns/:id/story-consent', async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE aid_campaigns SET story_consent=true,
      story_consent_at=COALESCE(story_consent_at,now()) WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found.' });
    res.json({ campaign: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/campaigns/:id/activate', async (req, res, next) => {
  try {
    const campaign = await withTransaction(async client => {
      const check = await client.query('SELECT * FROM aid_campaigns WHERE id=$1 FOR UPDATE', [req.params.id]);
      const row = check.rows[0];
      if (!row) return null;
      if (row.verification_status !== 'verified' || !row.story_consent) {
        const error = new Error('Campaign must be verified and have story consent before activation.');
        error.statusCode = 409;
        throw error;
      }
      await client.query(`UPDATE aid_campaigns SET status='paused' WHERE status='active' AND id<>$1`, [row.id]);
      const result = await client.query(`UPDATE aid_campaigns
        SET status='active', activated_at=COALESCE(activated_at,now()), completed_at=NULL
        WHERE id=$1 RETURNING *`, [row.id]);
      const activated = result.rows[0];
      if (activated.assistance_case_id) {
        await client.query(`UPDATE assistance_cases SET status='published',updated_at=now()
          WHERE id=$1`, [activated.assistance_case_id]);
      }
      return activated;
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    res.json({ campaign });
  } catch (error) { next(error); }
});

app.post('/api/campaigns/:id/pause', async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE aid_campaigns SET status='paused'
      WHERE id=$1 AND status='active' RETURNING *`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Active campaign not found.' });
    res.json({ campaign: result.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/cases', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT id,status,applicant_name,province,city,request_category,
      requested_cents,preferred_contact,open_to_public_story,submitted_at,created_at,
      (photo_storage_key IS NOT NULL) AS has_photo
      FROM assistance_cases WHERE status <> 'draft'
      ORDER BY COALESCE(submitted_at,created_at) DESC LIMIT 250`);
    res.json({ cases: result.rows });
  } catch (error) { next(error); }
});

app.get('/api/cases/:id', async (req, res, next) => {
  try {
    const [caseResult, notesResult, campaignsResult] = await Promise.all([
      pool.query(`SELECT id,status,applicant_name,applicant_email,province,city,preferred_contact,phone,
        request_category,request_summary,requested_cents,private_story,public_story_draft,
        public_identity_preference,public_alias,open_to_public_story,story_consent,
        eligibility_confirmed,accuracy_confirmed,privacy_acknowledged,submitted_at,reviewed_at,
        updated_at,created_at,(photo_storage_key IS NOT NULL) AS has_photo
        FROM assistance_cases WHERE id=$1`, [req.params.id]),
      pool.query(`SELECT id,note_text,actor,created_at FROM assistance_case_notes
        WHERE case_id=$1 ORDER BY created_at DESC`, [req.params.id]),
      pool.query(`SELECT id,slug,status,recipient_alias,public_title,goal_cents,verification_status,
        story_consent,created_at FROM aid_campaigns WHERE assistance_case_id=$1
        ORDER BY created_at DESC`, [req.params.id]),
    ]);
    if (!caseResult.rows[0]) return res.status(404).json({ error: 'Application not found.' });
    res.json({ case: caseResult.rows[0], notes: notesResult.rows, campaigns: campaignsResult.rows });
  } catch (error) { next(error); }
});

app.get('/api/cases/:id/photo', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT photo_storage_key FROM assistance_cases WHERE id=$1', [req.params.id]);
    const key = result.rows[0]?.photo_storage_key;
    if (!key) return res.status(404).end();
    res.set('Cache-Control', 'private, no-store');
    res.type('image/webp').sendFile(path.join(privateUploadDir, key));
  } catch (error) { next(error); }
});

app.patch('/api/cases/:id/status', async (req, res, next) => {
  try {
    const allowed = new Set(['draft','submitted','reviewing','need_more_info','shortlisted','approved','published','funded','declined','paid','closed']);
    const status = String(req.body?.status || '');
    if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid application status.' });
    const result = await pool.query(`UPDATE assistance_cases SET status=$1,
      reviewed_at=CASE WHEN $1 IN ('reviewing','need_more_info','shortlisted','approved','declined','closed') THEN COALESCE(reviewed_at,now()) ELSE reviewed_at END,
      updated_at=now() WHERE id=$2 RETURNING id,status`, [status, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Application not found.' });
    await pool.query(`INSERT INTO audit_log(actor_type,actor_id,event_type,entity_type,entity_id,data)
      VALUES ('admin',$1,'help_application_status_changed','assistance_case',$2,$3::jsonb)`,
      [adminUser, req.params.id, JSON.stringify({ status })]);
    res.json({ case: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/cases/:id/notes', async (req, res, next) => {
  try {
    const note = String(req.body?.note || '').trim();
    if (note.length < 2 || note.length > 5000) return res.status(400).json({ error: 'Note must be between 2 and 5000 characters.' });
    const exists = await pool.query('SELECT 1 FROM assistance_cases WHERE id=$1', [req.params.id]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'Application not found.' });
    const result = await pool.query(`INSERT INTO assistance_case_notes(case_id,note_text,actor)
      VALUES ($1,$2,$3) RETURNING id,note_text,actor,created_at`, [req.params.id, note, adminUser]);
    res.status(201).json({ note: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/cases/:id/create-wish', async (req, res, next) => {
  try {
    const body = req.body || {};
    const goalCents = Number(body.goalCents);
    if (!body.slug || !body.recipientAlias || !body.title || !body.summary || !Number.isInteger(goalCents) || goalCents <= 0) {
      return res.status(400).json({ error: 'Public slug, display name, title, public story and a positive goal are required.' });
    }
    const campaign = await withTransaction(async client => {
      const sourceResult = await client.query('SELECT * FROM assistance_cases WHERE id=$1 FOR UPDATE', [req.params.id]);
      const source = sourceResult.rows[0];
      if (!source) return null;
      if (!['shortlisted','approved'].includes(source.status)) {
        const error = new Error('Shortlist or approve the application before creating a public wish draft.');
        error.statusCode = 409;
        throw error;
      }
      const result = await client.query(`INSERT INTO aid_campaigns
        (assistance_case_id,slug,recipient_alias,city,province,public_title,public_summary,goal_cents,
         verification_status,story_consent)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'unverified',false) RETURNING *`, [
          source.id, String(body.slug).trim().toLowerCase(), String(body.recipientAlias).trim(),
          source.city, source.province, String(body.title).trim(), String(body.summary).trim(), goalCents,
        ]);
      await client.query(`UPDATE assistance_cases SET status='approved',updated_at=now(),
        reviewed_at=COALESCE(reviewed_at,now()) WHERE id=$1`, [source.id]);
      return result.rows[0];
    });
    if (!campaign) return res.status(404).json({ error: 'Application not found.' });
    res.status(201).json({ campaign });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ error: error.message || 'Internal server error.' });
});

const server = app.listen(port, bind, () => {
  console.log(`MapleWish admin listening on http://${bind}:${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down admin`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
