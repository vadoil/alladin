import pg from "pg";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let initialized = false;

function getPool() {
  if (!DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export async function initStorage() {
  const p = getPool();
  if (!p || initialized) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS niche_analyses (
      id BIGSERIAL PRIMARY KEY,
      request_id TEXT,
      niche TEXT NOT NULL,
      source TEXT,
      cached BOOLEAN DEFAULT FALSE,
      used_reference_profile BOOLEAN DEFAULT FALSE,
      latency_ms INT,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  initialized = true;
}

export async function saveAnalysis(row) {
  const p = getPool();
  if (!p) return;

  await initStorage();
  await p.query(
    `
    INSERT INTO niche_analyses
    (request_id, niche, source, cached, used_reference_profile, latency_ms, payload)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      row.requestId || null,
      row.niche,
      row.source || null,
      Boolean(row.cached),
      Boolean(row.usedReferenceProfile),
      row.latencyMs || null,
      JSON.stringify(row.payload),
    ]
  );
}
