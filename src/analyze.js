import { z } from "zod";
import { cacheGet, cacheSet } from "./cache.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS || 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 15000);
const RETRIES = Number(process.env.OPENAI_RETRIES || 2);
const RETRY_BASE_MS = Number(process.env.OPENAI_RETRY_BASE_MS || 500);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = (retrievedProfile) => `
Ты — маркетинговый аналитик. Твоя задача: по названию ниши
создать структурированный психографический профиль целевой аудитории.

Правила:
- Отвечай ТОЛЬКО валидным JSON, без пояснений
- Без markdown, без \`\`\`json\`\`\` обёрток
- Без вводных слов («Конечно!», «Вот результат»)
- Если ниша неизвестна — всё равно сделай лучшее предположение

Контекст из базы ниш:
${retrievedProfile ? JSON.stringify(retrievedProfile, null, 2) : "// пусто — игнорируй блок"}

Схема ответа (строго следуй ей):
{
  "niche": string,
  "client_portrait": string,
  "pains": string[],
  "fears": string[],
  "trust_triggers": string[],
  "tone_of_voice": string,
  "headline_formula": string,
  "cta": string,
  "palette": [
    { "role": string, "hex": string, "reason": string }
  ],
  "block_order": string[]
}
`.trim();

// ─── Validation ──────────────────────────────────────────────────────────────

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

const AnalysisSchema = z.object({
  niche: z.string().min(2),
  client_portrait: z.string().min(8),
  pains: z.array(z.string().min(2)).min(3).max(8),
  fears: z.array(z.string().min(2)).min(3).max(8),
  trust_triggers: z.array(z.string().min(2)).min(2).max(8),
  tone_of_voice: z.string().min(2),
  headline_formula: z.string().min(2),
  cta: z.string().min(2),
  palette: z
    .array(
      z.object({
        role: z.string().min(2),
        hex: z.string().regex(hexColorRegex, "hex must be #RRGGBB"),
        reason: z.string().min(2),
      })
    )
    .length(4),
  block_order: z.array(z.string().min(2)).min(4).max(12),
});

// ─── Static niche DB (replace with pgvector in production) ──────────────────

const NICHE_DB = [
  {
    tags: ["юрист", "юридические", "адвокат", "право", "закон"],
    profile: {
      niche: "Юридические услуги",
      client_portrait:
        "Собственник ИП или ООО, столкнулся с острой проблемой: претензия, проверка, спор. Хочет решение — не лекцию.",
      pains: [
        "Получил претензию и не знаю как реагировать",
        "Контрагент не платит уже 3 месяца",
        "Налоговая требует документы — паника",
      ],
      fears: [
        "Юрист возьмёт деньги и исчезнет",
        "Потрачу больше на юриста, чем стоит само дело",
        "Не поймут специфику моего бизнеса",
      ],
      trust_triggers: [
        "Кейс с конкретными цифрами из похожего дела",
        "Первая консультация бесплатно",
        "Ответ в течение часа",
      ],
      tone_of_voice: "Чёткий, уверенный, без жаргона",
      headline_formula: "[Решение проблемы] без [главный риск] за [срок/условие]",
      cta: "Опишите ситуацию — ответим за 60 минут",
      palette: [
        { role: "primary", hex: "#1A2744", reason: "авторитет" },
        { role: "accent", hex: "#2B4C8C", reason: "доверие" },
        { role: "highlight", hex: "#C9A84C", reason: "статус" },
        { role: "background", hex: "#F5F6F8", reason: "чистота" },
      ],
      block_order: [
        "hero",
        "pain_points",
        "how_it_works",
        "cases",
        "trust",
        "faq",
        "cta_final",
      ],
    },
  },
  {
    tags: ["ремонт", "строительство", "отделка", "квартира"],
    profile: {
      niche: "Ремонт квартир",
      client_portrait:
        "Владелец квартиры или новостройки, делает ремонт первый или второй раз. Боится обмана и некачественной работы.",
      pains: [
        "Не знаю кому доверять",
        "Боюсь, что выйдет дороже и дольше чем обещали",
        "Уже обжигался с прошлой бригадой",
        "Не разбираюсь в материалах",
      ],
      fears: [
        "Пропадут с деньгами на полпути",
        "Красивые фото, а на деле халтура",
        "Смета вырастет в 2 раза",
        "Ремонт растянется на год",
      ],
      trust_triggers: [
        "Фото до/после с реальными адресами",
        "Фиксированная смета с гарантией",
        "Видео с объекта в процессе работы",
        "Договор до начала работ",
      ],
      tone_of_voice: "Тёплый, честный, «мы как для себя»",
      headline_formula: "[Результат ремонта] за [срок] с [гарантия/условие]",
      cta: "Приедем, замерим и дадим смету — бесплатно",
      palette: [
        { role: "primary", hex: "#2C3E2D", reason: "надёжность" },
        { role: "accent", hex: "#5C8A6E", reason: "материал" },
        { role: "highlight", hex: "#D4945A", reason: "теплота" },
        { role: "background", hex: "#F9F6F0", reason: "уют" },
      ],
      block_order: [
        "hero",
        "portfolio",
        "how_it_works",
        "pricing",
        "reviews",
        "trust",
        "cta_final",
      ],
    },
  },
  {
    tags: ["консалтинг", "консультации", "бизнес", "стратегия", "управление"],
    profile: {
      niche: "Бизнес-консультации",
      client_portrait:
        "Собственник малого бизнеса 35–55 лет, выручка 5–50 млн/год. Ощущает потолок роста, всё держится лично на нём.",
      pains: [
        "Нет системы — всё держится на мне",
        "Команда не работает без контроля",
        "Деньги есть, но куда вкладывать — непонятно",
        "Конкуренты растут быстрее",
      ],
      fears: [
        "Заплачу — не получу результат",
        "Консультант не знает мою отрасль",
        "Это красивые слайды без практики",
        "Придётся всё менять, а это страшно",
      ],
      trust_triggers: [
        "Кейс с цифрами из той же ниши",
        "ROI первого месяца работы",
        "Бесплатный аудит как первый шаг",
        "Отзыв похожего клиента",
      ],
      tone_of_voice: "Деловой, конкретный, без воды",
      headline_formula: "[Результат бизнеса] без [страх] через [подход]",
      cta: "Разберём вашу ситуацию за 30 минут — бесплатно",
      palette: [
        { role: "primary", hex: "#1B2B4B", reason: "авторитет" },
        { role: "accent", hex: "#2D5FA0", reason: "доверие" },
        { role: "highlight", hex: "#E8A94D", reason: "результат" },
        { role: "background", hex: "#F5F7FA", reason: "ясность" },
      ],
      block_order: [
        "hero",
        "pain_points",
        "cases",
        "how_it_works",
        "about",
        "reviews",
        "cta_final",
      ],
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeNiche(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findSimilarNiche(normalizedNiche) {
  const q = normalizedNiche.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const entry of NICHE_DB) {
    const score = entry.tags.filter((tag) => q.includes(tag)).length;
    if (score > bestScore) {
      bestScore = score;
      best = entry.profile;
    }
  }

  return bestScore > 0 ? best : null;
}

function extractJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error("no_json_object_found");
    }
    return JSON.parse(raw.slice(first, last + 1));
  }
}

async function callOpenAIWithRetry({ normalized, retrieved }) {
  let lastErr;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT(retrieved) },
            { role: "user", content: `Ниша: "${normalized}"` },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`openai_http_${res.status}: ${errText}`);
      }

      const json = await res.json();
      return json?.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) {
        const delay = RETRY_BASE_MS * 2 ** attempt;
        await sleep(delay);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr;
}

// ─── Main function ───────────────────────────────────────────────────────────

export async function analyzeNiche(rawNiche) {
  const normalized = normalizeNiche(rawNiche || "");
  if (!normalized || normalized.length < 2) {
    return { ok: false, error: "invalid_niche", details: "niche is too short" };
  }

  const cacheKey = `niche:${normalized}`;
  const cachedData = await cacheGet(cacheKey);
  if (cachedData) {
    return { ok: true, data: cachedData, cached: true, source: "memory_cache" };
  }

  const retrieved = findSimilarNiche(normalized);

  if (!OPENAI_API_KEY) {
    return { ok: false, error: "missing_openai_api_key" };
  }

  try {
    const text = await callOpenAIWithRetry({ normalized, retrieved });

    if (!text) {
      return { ok: false, error: "empty_model_response" };
    }

    const parsed = extractJson(text);
    const validated = AnalysisSchema.parse(parsed);

    await cacheSet(cacheKey, validated);

    return {
      ok: true,
      data: validated,
      cached: false,
      source: "openai",
      used_reference_profile: Boolean(retrieved),
    };
  } catch (err) {
    if (err?.name === "ZodError") {
      return {
        ok: false,
        error: "schema_validation_failed",
        details: err.issues,
      };
    }

    return {
      ok: false,
      error: "analyze_failed",
      details: err?.message || String(err),
    };
  }
}
