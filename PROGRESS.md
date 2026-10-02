# PROGRESS — «Неоновый Рой» / Neon Swarm

Живой журнал работ. Следующая сессия продолжает отсюда.

## Статус фаз

| Фаза | Содержание | Статус |
|---|---|---|
| 0 | Требования, каркас, план | ✅ |
| 1 | Играбельное ядро | ✅ |
| 2 | Платформа (SDK, реклама, сохранения, i18n, zip) | ⏳ |
| 3 | Контент (8 оружий, пассивы, эволюции, враги, боссы, секторы, персонажи) | ⏳ |
| 4 | Метапрогрессия (Мастерская, достижения, Кодекс, ежедневки, Бесконечность, лидерборд) | ⏳ |
| 5 | Полировка (game feel, музыка, обучение, баланс, производительность) | ⏳ |
| 6 | Релиз (чек-лист, материалы `release/`) | ⏳ |

## План по файлам

```
index.html                 — /sdk.js, корневой div, загрузочный экран (inline CSS)
src/main.ts                — bootstrap: обработчики ошибок, платформа, i18n, сохранение, рендер, UI, ready()
src/config.ts              — константы (лидерборд, частота рекламы, лимиты)
src/core/                  — math (вектор, RNG), pool, spatial grid, emitter
src/data/                  — баланс: weapons, passives, enemies, waves, sectors, characters, workshop, achievements, rarity
src/game/                  — симуляция без DOM: World, Player, Enemy/Bullet/Gem, системы (spawn, weapons, AI, collisions, progression), Bot
src/render/                — Pixi: процедурные текстуры, GameView (синхронизация спрайтов), эффекты, фон
src/audio/                 — ZzFX-синтез SFX, процедурная музыка, AudioManager (громкость, mute-причины)
src/platform/              — Platform (интерфейс), YandexPlatform, LocalPlatform, detect, payments (заглушка)
src/meta/                  — сохранение (схема, версии, миграции, дебаунс), профиль, достижения, ежедневки
src/i18n/                  — ru, en, tr
src/ui/                    — DOM-экраны, HUD, карточки улучшений, джойстик, тосты, CSS
src/app/                   — Game: состояния (menu/run/results), причины пауз, оркестрация рекламы и GameplayAPI
scripts/                   — package.mjs (zip), simulate.ts (симулятор баланса), shots (скриншоты)
tests/unit, tests/e2e      — Vitest, Playwright
```

## Журнал

- **Фаза 0:** скачаны требования/SDK-доки, создан каркас (Vite + TS strict + Pixi 8 + ESLint + Vitest + Playwright), DECISIONS.md.

- **Фаза 1:** симуляция (World, 8 оружий, 13+ врагов, 3 мини-босса и финальный босс уже в коде), рендер Pixi (атлас с запечёнными glow-текстурами, ParticleContainer-слои, частицы, цифры урона, тряска, вспышки, hit-stop), DOM-UI (меню, выбор сектора, HUD, карточки улучшений, пауза, воскрешение, результаты, Мастерская, Персонажи, Кодекс, Достижения, Лидеры, Настройки, ежедневная награда), звук (ZzFX-синтез + процедурный синтвейв), платформа (Yandex/Local), сохранения с миграциями, i18n RU/EN/TR.

## Что дальше

- Фаза 2: zip-упаковка, юнит-тесты, проверка SDK-логики (пауза/звук/реклама), Playwright.

## Известные проблемы

- нет
