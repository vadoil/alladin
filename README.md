# Alladin v2 — AI Site Generator

Прод: https://alladin-ebon.vercel.app | Dashboard: /dashboard

## Новые файлы этапа 2

```
src/store.js              — файловый стор (read/write/delete/list)
src/builder.js            — blueprint → HTML лендинг
api/site/generate.js      — POST /api/site/generate
api/site/[siteId].js      — GET/DELETE /api/site/:siteId(/:action)
api/sites.js              — GET /api/sites
dashboard.html            — IT Dashboard
vercel.json               — обновлён роутинг
```

## Env

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MAX_TOKENS=1200
ANTHROPIC_TIMEOUT_MS=30000
ANTHROPIC_RETRIES=0
# DATA_DIR не нужен — Vercel пишет в /tmp/sites автоматически
```

## Тест локально

```bash
npm install && node src/server.js

# 1. Создать сайты
curl -X POST localhost:3000/api/site/generate -H "Content-Type: application/json" -d '{"niche":"юридические услуги"}'
curl -X POST localhost:3000/api/site/generate -H "Content-Type: application/json" -d '{"niche":"ремонт квартир"}'
curl -X POST localhost:3000/api/site/generate -H "Content-Type: application/json" -d '{"niche":"психолог онлайн"}'

# 2. Список
curl localhost:3000/api/sites

# 3. Preview (замени SITE_ID)
open http://localhost:3000/api/site/SITE_ID/preview

# 4. Delete
curl -X DELETE localhost:3000/api/site/SITE_ID
```

## Деплой

```bash
git add src/store.js src/builder.js api/site/ api/sites.js dashboard.html vercel.json
git commit -m "feat: site generation pipeline + IT dashboard"
git push
```

## Этап 3

- Postgres/KV (persistent storage на Vercel)
- Редактор блоков drag-and-drop
- Публикация на поддоменах *.alladin.site
- CRM: заявки с формы → dashboard
