# Niche Analyzer v1.1

AI-сервис: ниша → психографический профиль ЦА + порядок блоков сайта.

## Что есть в v1.1

- Zod-валидация ответа модели
- Retry + backoff + timeout
- Кэш: Redis (если `REDIS_URL`) или in-memory fallback
- Correlation ID (`x-request-id`) + structured logs (JSON)
- Batch endpoint: `POST /analyze/batch`
- Сохранение результатов в Postgres (если `DATABASE_URL`)
- Rate limit на API

## Быстрый старт

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
# optional
# export REDIS_URL=redis://localhost:6379
# export DATABASE_URL=postgres://user:pass@localhost:5432/niche
npm start
```

## API

### POST /analyze

```json
{ "niche": "бизнес-консультации" }
```

### POST /analyze/batch

```json
{ "niches": ["ремонт квартир", "юридические услуги", "b2b saas"] }
```

Запросы в batch выполняются **последовательно**, чтобы не устраивать burst в провайдера LLM.

### GET /health

Сервисный health-check.

## ENV

- `PORT=3000`
- `ANTHROPIC_MODEL=claude-sonnet-4-20250514`
- `ANTHROPIC_MAX_TOKENS=1024`
- `ANTHROPIC_TIMEOUT_MS=15000`
- `ANTHROPIC_RETRIES=2`
- `ANTHROPIC_RETRY_BASE_MS=500`
- `CACHE_TTL_MS=2592000000`
- `REDIS_URL=redis://...` (optional)
- `DATABASE_URL=postgres://...` (optional)
- `RATE_WINDOW_MS=60000`
- `RATE_LIMIT=60`
- `BATCH_LIMIT=10`
