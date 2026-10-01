import { createClient, type Client } from '@libsql/client';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

let client: Client | null = null;
let schemaInitialized = false;

export function getDb(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    client = createClient({ url, authToken });
  } else {
    const isVercel = process.env.VERCEL === '1';
    const dbDir = isVercel ? '/tmp' : join(process.cwd(), '.data');
    if (!existsSync(dbDir)) {
      try {
        mkdirSync(dbDir, { recursive: true });
      } catch {
        // directory already exists or cannot be created
      }
    }
    const dbPath = join(dbDir, 'listening-coach.db');
    client = createClient({ url: `file:${dbPath}` });
  }

  return client;
}

export async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS learners (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0
    )
  `);
  schemaInitialized = true;
}

export async function getLearnerRecord(id: string): Promise<{ data: string; revision: number } | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT data, revision FROM learners WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    data: String(row.data),
    revision: Number(row.revision ?? 0),
  };
}

export async function insertLearnerIfMissing(id: string, initialData: string): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: 'INSERT OR IGNORE INTO learners (id, data, revision) VALUES (?, ?, 0)',
    args: [id, initialData],
  });
}

export async function updateLearnerRecord(id: string, data: string, revision: number): Promise<boolean> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE learners SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
    args: [data, id, revision],
  });
  return Number(result.rowsAffected ?? 0) > 0;
}

export async function deleteLearnerRecord(id: string): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM learners WHERE id = ?',
    args: [id],
  });
}
