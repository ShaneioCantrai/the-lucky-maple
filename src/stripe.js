import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { pool, withTransaction } from './db.js';

const MINIMUM_LEAF_CENTS = 200;
const TERMS_VERSION = 'contributions-2026-09-19';
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

const checkoutIntentSchema = z.object({
  amountCents: z.number().int().min(MINIMUM_LEAF_CENTS).max(100_000_000),
  displayName: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(120).optional().default(''),
  email: z.string().trim().email().max(254),
  termsLanguage: z.enum(['en-CA', 'fr-CA']),
  frenchTermsPresented: z.literal(true),
  englishLanguageChoiceConfirmed: z.boolean().default(false),
});

function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

function signatureValues(header) {
  const values = new Map();
  for (const part of String(header || '').split(',')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(value);
  }
  return values;
}

function timingSafeHexEqual(left, right) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyStripeSignature(rawBody, header, secret) {
  if (!Buffer.isBuffer(rawBody) || !header || !secret) return false;
  const values = signatureValues(header);
  const timestamp = Number(values.get('t')?.[0]);
  const signatures = values.get('v1') || [];
  if (!Number.isFinite(timestamp) || !signatures.length) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');

  return signatures.some(signature => timingSafeHexEqual(signature, expected));
}

function stripeObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.id === 'string') return value.id;
  return null;
}

async function processStripeEvent(event) {
  return withTransaction(async client => {
    await client.query(
      `INSERT INTO stripe_webhook_events(id,event_type)
       VALUES ($1,$2)
       ON CONFLICT (id) DO NOTHING`,
      [event.id, event.type],
    );

    const eventRecord = await client.query(
      'SELECT processed_at FROM stripe_webhook_events WHERE id=$1 FOR UPDATE',
      [event.id],
    );
    if (eventRecord.rows[0]?.processed_at) return 'duplicate';

    const session = event?.data?.object;
    const paymentLinkId = process.env.STRIPE_PAYMENT_LINK_ID || '';
    const clientReferenceId = String(session?.client_reference_id || '');

    if (session?.object !== 'checkout.session' ||
        !paymentLinkId ||
        session.payment_link !== paymentLinkId ||
        !/^[0-9a-f-]{36}$/i.test(clientReferenceId)) {
      await client.query('UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1', [event.id]);
      return 'ignored';
    }

    const intentResult = await client.query(
      'SELECT * FROM stripe_checkout_intents WHERE id=$1 FOR UPDATE',
      [clientReferenceId],
    );
    const intent = intentResult.rows[0];
    if (!intent) {
      await client.query('UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1', [event.id]);
      return 'unknown-reference';
    }

    if (event.type === 'checkout.session.expired') {
      await client.query(
        `UPDATE stripe_checkout_intents
         SET status=CASE WHEN status='pending' THEN 'expired' ELSE status END,
             stripe_session_id=COALESCE(stripe_session_id,$2)
         WHERE id=$1`,
        [intent.id, session.id],
      );
      await client.query('UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1', [event.id]);
      return 'expired';
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      await client.query(
        `UPDATE stripe_checkout_intents
         SET status=CASE WHEN status='pending' THEN 'failed' ELSE status END,
             stripe_session_id=COALESCE(stripe_session_id,$2)
         WHERE id=$1`,
        [intent.id, session.id],
      );
      await client.query('UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1', [event.id]);
      return 'failed';
    }

    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await client.query('UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1', [event.id]);
      return 'ignored-event';
    }

    if (session.payment_status !== 'paid') {
      await client.query('UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1', [event.id]);
      return 'awaiting-payment';
    }

    const amountCents = Number(session.amount_total);
    const currency = String(session.currency || '').toLowerCase();
    if (!Number.isInteger(amountCents) || amountCents < MINIMUM_LEAF_CENTS || currency !== 'cad') {
      throw new Error('Stripe session has an invalid MapleWish payment amount or currency.');
    }

    const existing = await client.query(
      `SELECT id FROM leaf_orders
       WHERE payment_provider='stripe' AND payment_reference=$1
       LIMIT 1`,
      [session.id],
    );

    let orderId = existing.rows[0]?.id || null;
    if (!orderId) {
      const purchaserEmail = String(
        session.customer_details?.email ||
        session.customer_email ||
        intent.email ||
        ''
      ).trim().toLowerCase();
      if (!purchaserEmail) throw new Error('Stripe session did not provide a purchaser email.');

      const helpAllocationCents = Math.ceil(amountCents / 2);
      const order = await client.query(
        `INSERT INTO leaf_orders
         (status,purchaser_email,leaf_count,amount_total_cents,help_allocation_cents,
          payment_provider,payment_reference,paid_at)
         VALUES ('paid',$1,1,$2,$3,'stripe',$4,now())
         RETURNING id`,
        [purchaserEmail, amountCents, helpAllocationCents, session.id],
      );
      orderId = order.rows[0].id;

      await client.query(
        `INSERT INTO leaves(order_id,display_name,message,colour)
         VALUES ($1,$2,$3,'red')`,
        [
          orderId,
          intent.display_name || 'Anonymous Canadian',
          intent.message || null,
        ],
      );

      await client.query(
        `INSERT INTO help_fund_ledger(entry_type,amount_cents,order_id,note)
         VALUES ('leaf_allocation',$1,$2,$3)`,
        [
          helpAllocationCents,
          orderId,
          `50% MapleWish direct-help allocation from Stripe Checkout Session ${session.id}`,
        ],
      );
    }

    await client.query(
      `UPDATE stripe_checkout_intents
       SET status='paid',
           stripe_session_id=$2,
           stripe_payment_intent_id=$3,
           order_id=$4,
           paid_at=COALESCE(paid_at,now())
       WHERE id=$1`,
      [intent.id, session.id, stripeObjectId(session.payment_intent), orderId],
    );

    await client.query('UPDATE stripe_webhook_events SET processed_at=now() WHERE id=$1', [event.id]);
    return existing.rows[0] ? 'already-fulfilled' : 'fulfilled';
  });
}

export function registerStripeWebhookRoute(app) {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    async (req, res, next) => {
      try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
        if (!webhookSecret) return res.status(503).json({ error: 'Stripe webhook is not configured.' });

        const signature = req.get('stripe-signature');
        if (!verifyStripeSignature(req.body, signature, webhookSecret)) {
          return res.status(400).json({ error: 'Invalid Stripe signature.' });
        }

        const event = JSON.parse(req.body.toString('utf8'));
        if (!event?.id || !event?.type) return res.status(400).json({ error: 'Invalid Stripe event.' });

        const result = await processStripeEvent(event);
        res.json({ received: true, result });
      } catch (error) {
        next(error);
      }
    },
  );
}

export function registerStripeCheckoutRoute(app) {
  const checkoutLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30 });

  app.post('/api/checkout', checkoutLimiter, async (req, res, next) => {
    try {
      if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-site request rejected.' });

      const paymentLinkUrl = process.env.STRIPE_PAYMENT_LINK_URL || '';
      const paymentLinkId = process.env.STRIPE_PAYMENT_LINK_ID || '';
      if (!paymentLinkUrl || !paymentLinkId) {
        return res.status(503).json({ error: 'Stripe checkout is not configured yet.' });
      }

      const checkout = checkoutIntentSchema.parse(req.body);
      if (checkout.termsLanguage === 'en-CA' && !checkout.englishLanguageChoiceConfirmed) {
        return res.status(400).json({
          error: 'Please expressly choose English after the French contribution terms are presented.',
        });
      }

      const result = await pool.query(
        `INSERT INTO stripe_checkout_intents
         (display_name,message,email,amount_prefill_cents,terms_language,
          french_terms_presented,english_language_choice_confirmed,terms_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          checkout.displayName || 'Anonymous Canadian',
          checkout.message || null,
          checkout.email.toLowerCase(),
          checkout.amountCents,
          checkout.termsLanguage,
          checkout.frenchTermsPresented,
          checkout.englishLanguageChoiceConfirmed,
          TERMS_VERSION,
        ],
      );

      const url = new URL(paymentLinkUrl);
      url.searchParams.set('client_reference_id', result.rows[0].id);
      url.searchParams.set('prefilled_amount', String(checkout.amountCents));
      url.searchParams.set('prefilled_email', checkout.email.toLowerCase());
      url.searchParams.set('locale', checkout.termsLanguage === 'fr-CA' ? 'fr' : 'en');

      res.status(201).json({ checkoutUrl: url.toString() });
    } catch (error) {
      next(error);
    }
  });
}

