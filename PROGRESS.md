# PROGRESS — «Последний Бастион» / Last Bastion

## Статус
- [x] Фаза 0 — каркас, требования, план
- [x] Фаза 1 — играбельное ядро (вместе с данными всех построек/врагов/карт)
- [ ] Фаза 2 — платформа, SDK, сохранения, локализация, zip
- [ ] Фаза 3 — контент (все постройки, враги, 3 карты)
- [ ] Фаза 4 — метапрогрессия
- [ ] Фаза 5 — полировка, баланс
- [ ] Фаза 6 — релиз

## План по файлам
```
index.html                 — <script src="/sdk.js">, точка входа, экран загрузки (inline CSS)
src/main.ts                — бутстрап: платформа → сохранения → рендер → меню → ready()
src/core/                  — math, rng, events, spatial grid, input, loop, errors
src/data/                  — config, buildings (дерево улучшений), units, weapons, perks, mutators,
                             achievements, maps, waves (параметры генератора)
src/entities/              — Hero, Unit, Building, Projectile (чистое состояние)
src/systems/               — Game (корень симуляции), economy, construction, combat, waves,
                             daynight, ai, bot (для симулятора и смоук-тестов), meta, achievements
src/world/                 — Three.js: renderer/quality, terrain, decor, models, instancing,
                             effects, lighting/sky, camera, icon renderer, view-синхронизация
src/audio/                 — WebAudio: zzfx, sfx, процедурная музыка, микшер
src/ui/                    — DOM-оверлей: HUD, джойстик, экраны меню, обучение, стили
src/platform/              — Platform, YandexPlatform, LocalPlatform, payments.ts (заглушка)
src/save/                  — схема, миграции, дебаунс, облако+localStorage
src/i18n/                  — ru.ts, en.ts
tests/unit/                — Vitest: экономика, строительство, ветки, волны, сохранения
tests/e2e/                 — Playwright смоук
scripts/                   — simulate.ts (баланс), package.mjs (zip), screenshots.mjs
release/                   — zip, иконка, обложка, скриншоты, RELEASE.md
```

## Сделано (Фаза 1)
- Симуляция (чистый TS): Game, экономика, строительство с удержанием, дерево улучшений (10 построек × 2 ветки × 2 мода),
  ИИ врагов/союзников, стены-отрезки, снаряды, герой (автоатака + способность), волны (детерминированный генератор), бот.
- Рендер Three.js: единый flat-материал со свечением, процедурные модели всех построек/юнитов/героя, ландшафт с водой,
  деревьями (instanced), ленты путей атаки, частицы/монеты/кольца, тряска, день/ночь, авто-качество.
- UI: HUD, кольцо удержания, индикаторы волн у краёв экрана, окно выбора ветки, меню и все экраны, обучение.
- Платформа: Yandex/Local, реклама с паузой и тишиной, GameplayAPI, облачные сохранения + localStorage + миграции.
- Тесты: Vitest (36), Playwright смоук (10, три вьюпорта + мок SDK). Сборка 830 КБ, zip 294 КБ.

## Что дальше
- Фаза 2: проверка требований (фокус/звук/пауза), упаковка — готово частично; RELEASE.md позже.
- Фаза 3: визуальная проверка карт 2 и 3, боссы.
- Фаза 5: баланс через симулятор (бот пока проигрывает долине на 7–8 ночи).

## Известные проблемы
- Баланс не настроен.
- Headless Chromium рендерит через SwiftShader (≈4 FPS) — FPS проверять по числу треугольников/вызовов.
