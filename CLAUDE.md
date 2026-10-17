# CLAUDE.md — ZhasylDala

Инструкции для Claude Code при работе с этим репозиторием.
Текущее состояние и история работ — в [PROGRESS.md](PROGRESS.md).

## Что это за проект

ZhasylDala — диагностика болезней растений в теплицах (жылыжай) по фото,
на казахском языке. Проект для республиканского конкурса (секция
«Биология»), автор — Альбина. Два сценария:

1. **Фермер с теплицей** — регистрация (телефон + пароль) → выбор культуры
   → сетка секторов → QR-код на каждый сектор → обход теплицы: скан QR →
   3–10 фото сектора → диагноз + недельный план обработки с чек-листом.
2. **Домашнее растение** — без регистрации: фото → диагноз и советы.

Плюс админка `/admin` (React) для датасета, обучения и активации офлайн-модели.

## Стек и структура

```
backend/    Django + DRF, Celery, ML (OpenAI vision + офлайн MobileNetV3)
  apps/accounts      пользователи (телефон + пароль)
  apps/greenhouses   теплицы, секторы (рваная сетка row_counts), QR
  apps/scans         обходы, фото секторов (sector_photos / finish_sector)
  apps/diagnosis     диагнозы, ai_narrative, source
  apps/plans         план обработки (генерация идемпотентна!)
  apps/tips          советы
  apps/ml            openai_vision.py (основной), services.py (diagnose_image,
                     fallback-цепочка), registry.py, training.py, tasks.py
  apps/ml_training   TrainingImage, ModelVersion, TrainingJob
  apps/core          seed_data, bootstrap_plantvillage, permissions
  config/            settings.py (всё через env), urls.py (SPA fallback, /media)
frontend/   React 18 + Vite + zustand + react-router, PWA, jsQR
  src/screens/       Welcome, RoleSelect, Login, Dashboard, SectorDetail,
                     PlanScreen, Report, Tips, Profile, setup/*, scan/ScanFlow,
                     home/HomePlantFlow, admin/*
  src/styles/        tokens.css, shell.css (мобильная оболочка), admin.css
Dockerfile.railway + railway.json   прод-деплой одним образом (gunicorn)
docker-compose.yml                  локально: Postgres + Redis + web + worker + nginx
```

## Как запускать

```bash
# backend
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt            # + requirements-ml.txt для офлайн-модели
cp .env.example .env && python manage.py migrate && python manage.py seed_data
python manage.py runserver
python manage.py test                       # тесты

# frontend
cd frontend && npm install && npm run dev   # :5173, проксирует /api и /media на :8000
```

Без Redis задачи Celery выполняются inline (`CELERY_TASK_ALWAYS_EAGER` = DEBUG).

## Диагностика — как устроено

`apps/ml/services.py: diagnose_image` — цепочка:
1. **OpenAI vision** (`apps/ml/openai_vision.py`, модель `gpt-4o`) — нужен
   `OPENAI_API_KEY`. Определяет растение и болезнь, пишет карточки
   «Себебі / Емдеу жолы / Алдын алу кеңестері / ободрение» на казахском,
   без эмодзи. Для сектора — групповой анализ нескольких фото + какие фото
   показывают болезнь.
2. **Офлайн-модель** MobileNetV3-Small, обученная на PlantVillage
   (томат/перец/клубника) — если нет ключа/интернета.
3. Нейтральный ответ «модель ещё не обучена».

Никогда не бросает исключение наружу — сбой одного уровня = переход к следующему.

## Правила работы

- **Язык UI — казахский.** Все пользовательские тексты, ошибки, кнопки —
  на казахском. Общение с Альбиной — на русском.
- **Дизайн не должен выглядеть как «нейрослоп».** Цвета из `tokens.css`
  не менять, но избегать шаблонных ИИ-приёмов (одинаковые карточки с
  тенью, градиенты, эмодзи-иконки, всё по центру). Делать уникально.
- **Мобильный UX прежде всего**, особенно iPhone/Safari. Оболочка
  `.app-shell` закреплена `position: fixed` (не `100dvh`) — это фикс
  зависания при открытой клавиатуре iOS; не ломать.
- **Ошибки не глотать молча** — каждый запрос в UI должен показывать
  ошибку и состояние загрузки (`busy`). `useSetupStore` намеренно не
  персистится — экраны мастера редиректят на `/register`, если
  `greenhouseId` пропал.
- Генерация плана обработки должна оставаться **идемпотентной** (не
  стирать отмеченные пункты).
- Сектор диагностируется по **фото (3–10)**, не по видео — видео-пайплайн
  удалён, не возвращать.
- Kindwise и Pl@ntNet удалены — не добавлять обратно без запроса.
- Секреты только в env (`.env` в .gitignore). Не коммитить ключи.
- Деплой: push в `main` → Railway пересобирает автоматически. Поэтому
  коммитить/пушить только по просьбе.
- После значимых изменений — обновлять [PROGRESS.md](PROGRESS.md)
  (и README/DEPLOY.md/ZAWITA_PROEKTA.md, если меняется поведение).
- Комментарии в коде — на английском, подробные «почему», как в
  существующем коде.

## Документы в репо

- `README.md` — архитектура, запуск, обучение модели (англ.)
- `DEPLOY.md` — пошаговый деплой на Railway со своим доменом (рус.)
- `ZAWITA_PROEKTA.md` — шпаргалка к защите проекта перед жюри (рус.)
- `PROGRESS.md` — что сделано, что дальше
