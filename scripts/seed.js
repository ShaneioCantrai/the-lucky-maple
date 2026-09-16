import 'dotenv/config';
import { pool } from '../src/db.js';

if (process.env.SEED_PROTOTYPE_CONTEST !== 'true') {
  console.log('Prototype contest seed disabled.');
  await pool.end();
  process.exit(0);
}

const current = await pool.query(
  `SELECT id FROM contest_weeks
   WHERE status = 'open' AND now() >= opens_at AND now() < closes_at
   LIMIT 1`);

if (!current.rows[0]) {
  const opens = new Date();
  const closes = new Date(opens.getTime() + 7 * 24 * 60 * 60 * 1000);
  const draw = new Date(closes.getTime() + 12 * 60 * 60 * 1000);
  const label = `Prototype week ${opens.toISOString().slice(0, 10)}`;
  await pool.query(
    `INSERT INTO contest_weeks
     (label, opens_at, closes_at, draw_at, prize_cents, status,
      funding_source, rules_version)
     VALUES ($1,$2,$3,$4,10000,'open',$5,$6)`,
    [label, opens, closes, draw, 'Founder-funded prototype',
     process.env.RULES_VERSION || 'prototype-0.1']);
  console.log(`Created ${label}`);
} else {
  console.log('Open contest already exists.');
}

await pool.end();
