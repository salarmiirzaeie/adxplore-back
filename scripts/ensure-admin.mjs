#!/usr/bin/env node
/**
 * Upsert admin user (phone + bcrypt password).
 *   node scripts/ensure-admin.mjs
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pg from 'pg';

const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '09035128132';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Soheyl@9143073321';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Admin';

function normalizeIranPhone(phone) {
  const digits = phone.replace(/[\s\-()]/g, '');
  let normalized = digits;
  if (normalized.startsWith('+98')) normalized = '0' + normalized.slice(3);
  else if (normalized.startsWith('98') && normalized.length === 12)
    normalized = '0' + normalized.slice(2);
  else if (normalized.startsWith('9') && normalized.length === 10)
    normalized = '0' + normalized;
  return normalized;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const phone = normalizeIranPhone(ADMIN_PHONE);
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);

  try {
    const existing = await client.query(
      `SELECT id FROM "User" WHERE phone = $1`,
      [phone],
    );
    if (existing.rows[0]) {
      await client.query(
        `UPDATE "User"
         SET role = 'ADMIN'::"UserRole",
             "passwordHash" = $1,
             name = $2,
             "updatedAt" = NOW()
         WHERE id = $3`,
        [passwordHash, ADMIN_NAME, existing.rows[0].id],
      );
      console.log(`Admin updated: ${phone} id=${existing.rows[0].id}`);
      return;
    }

    const id = crypto.randomBytes(12).toString('hex');
    await client.query(
      `INSERT INTO "User" (id, phone, "passwordHash", name, role, categories, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ADMIN'::"UserRole", '[]'::jsonb, NOW(), NOW())`,
      [id, phone, passwordHash, ADMIN_NAME],
    );
    console.log(`Admin created: ${phone} id=${id}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
