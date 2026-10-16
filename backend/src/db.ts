import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
if (!process.env.DATABASE_URL) console.warn('DATABASE_URL não configurada. Configure backend/.env antes de iniciar.');
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });
