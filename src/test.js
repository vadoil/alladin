// Быстрый тест без запуска сервера
// node src/test.js "ваша ниша"

import { analyzeNiche } from "./analyze.js";

const niche = process.argv[2] || "бизнес-консультации";

console.log(`\nАнализируем нишу: "${niche}"\n${"─".repeat(50)}`);

const result = await analyzeNiche(niche);

if (!result.ok) {
  console.error("Ошибка:", result.error);
  console.error("Raw:", result.raw);
  process.exit(1);
}

const d = result.data;
console.log(`\nНиша:         ${d.niche}`);
console.log(`Кэш (база):   ${result.cached ? "да" : "нет"}`);
console.log(`\nКлиент:\n  ${d.client_portrait}`);
console.log(`\nБоли:\n${d.pains.map((p) => `  • ${p}`).join("\n")}`);
console.log(`\nСтрахи:\n${d.fears.map((f) => `  • ${f}`).join("\n")}`);
console.log(
  `\nТриггеры доверия:\n${d.trust_triggers.map((t) => `  • ${t}`).join("\n")}`
);
console.log(`\nTone of voice: ${d.tone_of_voice}`);
console.log(`Заголовок:     ${d.headline_formula}`);
console.log(`CTA:           ${d.cta}`);
console.log(
  `\nПалитра:\n${d.palette.map((p) => `  ${p.role.padEnd(12)} ${p.hex}  (${p.reason})`).join("\n")}`
);
console.log(`\nПорядок блоков: ${d.block_order.join(" → ")}`);
