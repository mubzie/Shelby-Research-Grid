import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import config from '../config';

const connectionString = process.env.DATABASE_URL || config.database.url;
const pool = new Pool({ connectionString });

export default pool;

export async function initDb(): Promise<void> {
  if (!connectionString) {
    console.warn('No DATABASE_URL provided; skipping DB initialization (dev mode).');
    return;
  }

  try {
    // Try a simple connect first
    const client = await pool.connect();
    try {
      const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(sql);
        console.log('Database schema initialized.');
      } else {
        console.warn('schema.sql not found; skipping schema initialization.');
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('Could not initialize DB (is Postgres running?). Skipping DB init for now.');
    console.warn(err.message || err);
  }
}
