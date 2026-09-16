import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pool, dbHealth, withTransaction } from './db.js';
import { contestEntrySchema, helpApplicationSchema, mockPurchaseSchema } from './schemas.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const bindAddress = process.env.BIND_ADDRESS || '0.0.0.0';
const rulesVersion = process.env.RULES_VERSION || 'prototype-0.1';
const identitySecret = process.env.IDENTITY_HASH_SECRET || 'development-only-change-me';
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
app.get('/app.js', (_req, res) => res.sendFile(path.join(repoRoot, 'app.js')));
app.get('/styles.css', (_req, res) => res.sendFile(path.join(repoRoot, 'styles.css')));
app.use('/img/web', express.static(path.join(repoRoot, 'img', 'web'), { maxAge: '1h', immutable: false }));

function identityHash(email) {
  return crypto.createHmac('sha256', identitySecret)
    .update(email.trim().toLowerCase())
    .digest('hex');
}

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

app.post('/api/help/applications', async (req, res, next) => {
  try {
    if (process.env.ENABLE_HELP_APPLICATIONS !== 'true') {
      return res.status(503).json({ error: 'Applications are not open yet.' });
    }
    const item = helpApplicationSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO assistance_cases
       (applicant_name, applicant_email, province, request_category,
        request_summary, requested_cents, story_consent, story_consent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $7 THEN now() END)
       RETURNING id`,
      [item.name, item.email.toLowerCase(), item.province, item.category,
       item.summary, item.requestedCents, item.storyConsent]);
    res.status(201).json({ submitted: true, reference: result.rows[0].id });
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
  console.log(`The Lucky Maple listening on ${bindAddress}:${port}`);
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
