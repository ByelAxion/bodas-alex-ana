import { pool } from './db.js';
const sql = `
CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS invitations (id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL, group_name TEXT NOT NULL, authorized_count INTEGER NOT NULL CHECK (authorized_count > 0), active BOOLEAN NOT NULL DEFAULT TRUE, confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS guests (id SERIAL PRIMARY KEY, invitation_id INTEGER NOT NULL REFERENCES invitations(id) ON DELETE CASCADE, name TEXT NOT NULL, attending BOOLEAN NOT NULL DEFAULT FALSE, UNIQUE(invitation_id, name));
CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, invitation_id INTEGER REFERENCES invitations(id) ON DELETE SET NULL, recipient TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`;
try { await pool.query(sql); console.log('Tabelas criadas.'); } catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
