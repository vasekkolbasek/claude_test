# PROGRESS — «Последний Бастион» / Last Bastion

## Статус
- [x] Фаза 0 — каркас, требования, план
- [ ] Фаза 1 — играбельное ядро
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

## Что дальше
Фаза 1.

## Известные проблемы
—
