#!/usr/bin/env node
/**
 * Upsert admin user (phone + bcrypt password).
 *   node scripts/ensure-admin.mjs
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

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

const dbPath = path.resolve(process.cwd(), url.replace(/^file:/, ''));
const db = new Database(dbPath);
const phone = normalizeIranPhone(ADMIN_PHONE);
const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
const now = new Date().toISOString();

const existing = db.prepare('SELECT id FROM User WHERE phone = ?').get(phone);
if (existing) {
  db.prepare(
    `UPDATE User SET role = 'ADMIN', passwordHash = ?, name = ?, updatedAt = ? WHERE id = ?`,
  ).run(passwordHash, ADMIN_NAME, now, existing.id);
  console.log(`Admin updated: ${phone} id=${existing.id}`);
} else {
  const id = crypto.randomBytes(12).toString('hex');
  db.prepare(
    `INSERT INTO User (id, phone, passwordHash, name, role, categories, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'ADMIN', '[]', ?, ?)`,
  ).run(id, phone, passwordHash, ADMIN_NAME, now, now);
  console.log(`Admin created: ${phone} id=${id}`);
}
db.close();
