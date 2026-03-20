import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';

// In Vercel production /tmp is the only writable dir
const DATA_ROOT = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : (process.env.VERCEL ? '/tmp/sites' : resolve('data/sites'));

function siteDir(siteId) {
  // Sanitize: only allow alphanumeric + dash
  if (!/^[a-z0-9-]{8,40}$/.test(siteId)) throw new Error('Invalid siteId');
  return join(DATA_ROOT, siteId);
}

export function generateId() {
  return randomBytes(6).toString('hex'); // 12-char hex
}

export function ensureDataRoot() {
  if (!existsSync(DATA_ROOT)) mkdirSync(DATA_ROOT, { recursive: true });
}

export function saveSite(siteId, { blueprint, html, meta }) {
  const dir = siteDir(siteId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'site.json'),  JSON.stringify(blueprint, null, 2), 'utf8');
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  writeFileSync(join(dir, 'meta.json'),  JSON.stringify(meta, null, 2), 'utf8');
}

export function getSiteMeta(siteId) {
  const dir = siteDir(siteId);
  if (!existsSync(join(dir, 'meta.json'))) return null;
  return JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
}

export function getSiteBlueprint(siteId) {
  const dir = siteDir(siteId);
  if (!existsSync(join(dir, 'site.json'))) return null;
  return JSON.parse(readFileSync(join(dir, 'site.json'), 'utf8'));
}

export function getSiteHtml(siteId) {
  const dir = siteDir(siteId);
  const path = join(dir, 'index.html');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

export function deleteSite(siteId) {
  const dir = siteDir(siteId);
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  return true;
}

export function listSites() {
  ensureDataRoot();
  if (!existsSync(DATA_ROOT)) return [];
  return readdirSync(DATA_ROOT)
    .filter(name => {
      try {
        const stat = statSync(join(DATA_ROOT, name));
        return stat.isDirectory();
      } catch { return false; }
    })
    .map(siteId => {
      try {
        const meta = getSiteMeta(siteId);
        return meta ? { siteId, ...meta } : null;
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
}
