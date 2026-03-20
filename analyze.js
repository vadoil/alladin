import Anthropic from "@anthropic-ai/sdk";
import { NICHE_DB, ANALYZE_SYSTEM, BLUEPRINT_SYSTEM } from "./prompts.js";

// ─── Конфиг (Vercel env-safe) ─────────────────────────────────────────────────

const MODEL   = "claude-sonnet-4-20250514";
const TOKENS  = parseInt(process.env.ANTHROPIC_MAX_TOKENS  || "700",  10);
const TIMEOUT = parseInt(process.env.ANTHROPIC_TIMEOUT_MS  || "30000", 10);
const RETRIES = parseInt(process.env.ANTHROPIC_RETRIES     || "0",    10);

// ─── Утилиты ──────────────────────────────────────────────────────────────────

export function normalizeNiche(raw) {
  return raw.trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е")
    .replace(/[^\wа-яa-z\s]/gi, "");
}

export function findSimilarNiche(normalized) {
  let best = null, bestScore = 0;
  for (const entry of NICHE_DB) {
    const score = entry.tags.filter(t => normalized.includes(t)).length;
    if (score > bestScore) { bestScore = score; best = entry.profile; }
  }
  return bestScore > 0 ? best : null;
}

function safeParseJSON(raw) {
  try { return JSON.parse(raw.trim()); } catch (_) {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

// ─── Вызов Claude ─────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userMsg, maxTokens = TOKENS) {
  const client = new Anthropic({
    timeout: TIMEOUT,
    maxRetries: RETRIES,
  });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  return res.content[0].text;
}

// ─── /api/analyze — обратная совместимость ────────────────────────────────────

export async function analyzeNiche(rawNiche) {
  const normalized = normalizeNiche(rawNiche);
  const retrieved  = findSimilarNiche(normalized);

  const raw = await callClaude(
    ANALYZE_SYSTEM(retrieved),
    `Ниша: "${normalized}"`
  );

  const data = safeParseJSON(raw);
  if (!data) return { ok: false, error: "JSON parse failed", raw };

  return { ok: true, data, cached: !!retrieved };
}

// ─── /api/site-blueprint — новый endpoint ─────────────────────────────────────

export async function siteBlueprint(rawNiche) {
  const normalized = normalizeNiche(rawNiche);
  const retrieved  = findSimilarNiche(normalized);

  const raw = await callClaude(
    BLUEPRINT_SYSTEM(retrieved),
    `Ниша: "${normalized}"`,
    1200  // blueprint больше — нужно больше токенов
  );

  const data = safeParseJSON(raw);
  if (!data) return { ok: false, error: "JSON parse failed", raw };

  // Валидация: проверяем обязательные поля
  const required = ["niche", "utp_short", "utp_long", "sections"];
  const missing  = required.filter(k => !data[k]);
  if (missing.length) {
    return { ok: false, error: `Missing fields: ${missing.join(", ")}`, data };
  }

  // Проверка на банальщину
  const banWords = ["профессионализм", "качество", "команда профессионалов", "индивидуальный подход"];
  const allText  = JSON.stringify(data).toLowerCase();
  const banned   = banWords.filter(w => allText.includes(w));
  const quality  = { banality_score: banned.length, banned_words: banned };

  return { ok: true, data, cached: !!retrieved, quality };
}
