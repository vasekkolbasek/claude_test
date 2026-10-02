# PROGRESS — «Последний Бастион» / Last Bastion

## Статус
- [x] Фаза 0 — каркас, требования, план
- [x] Фаза 1 — играбельное ядро
- [x] Фаза 2 — платформа, SDK, реклама, сохранения, локализация, zip
- [x] Фаза 3 — контент: 10 построек × (база + 2 ветки + 4 мода), 8 врагов + 3 босса, 3 карты
- [x] Фаза 4 — метапрогрессия: 4 оружия, 10 перков, 5 мутаторов, 24 достижения, «Бесконечные ночи», лидерборд
- [x] Фаза 5 — полировка: свет день/ночь, светлячки, анимации, процедурная музыка, обучение, баланс, производительность
- [x] Фаза 6 — релиз: `release/` (zip, иконка, обложки RU/EN, 10 скриншотов), `RELEASE.md`, чек-лист

## Как проверить
```
npm ci
npm run typecheck && npm run lint && npm run test      # 37 unit-тестов
npm run build && npm run package                        # release/last-bastion.zip (~300 КБ)
npm run smoke                                           # 13 Playwright-тестов, 3 вьюпорта + мок SDK
npm run sim                                             # симулятор баланса
node scripts/screenshots.mjs                            # медиа для стора
```

## Структура
```
index.html                 — <script src="/sdk.js">, загрузчик
src/main.ts, src/app.ts    — бутстрап и поток меню → партия → итоги (реклама, пауза, сохранения, GameplayAPI)
src/core/                  — math, rng, events, spatial grid, input (клавиатура/мышь/джойстик), errors
src/data/                  — config, buildings (дерево улучшений), units, weapons, perks/мутаторы, achievements, maps
src/entities/              — Unit, Building, Hero, Projectile
src/systems/               — Game (фазы, экономика, строительство), ai, combat, waves, terrain, meta, bot
src/world/                 — Three.js: stage (рендер/свет/камера/качество), terrainView, entityView, fx, models,
                             material (свечение), icons, View, promo (арт для стора)
src/audio/                 — zzfx, sfx, процедурная музыка и микшер
src/ui/                    — HUD, экраны, обучение, стили
src/platform/              — Platform, YandexPlatform, LocalPlatform, payments (заглушка)
src/save/                  — схема v2, миграции, дебаунс, облако + localStorage
src/i18n/                  — ru, en
tests/unit, tests/e2e      — Vitest и Playwright (+ мок SDK)
scripts/                   — simulate.ts, package.mjs, screenshots.mjs, serve.mjs
```

## Известные ограничения
- Headless Chromium рендерит через SwiftShader (≈4 FPS), поэтому реальный FPS на устройствах не измерялся.
  Косвенно: ~70 draw calls, 110–170 тыс. треугольников (с тенями), симуляция 0.4 мс/кадр при 180 юнитах;
  авто-качество снижает тени/pixel ratio при FPS < 42.
- Музыка и звуки проверены только на отсутствие ошибок (на слух — нет возможности в облаке).
- Лидерборд нужно создать в консоли (`endlessNights`), иначе экран лидеров покажет локальный рекорд.
