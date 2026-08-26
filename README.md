# ZhasylDala

Greenhouse ("жылыжай") plant-disease diagnostics — a mobile-app-styled
website (React), a Django REST API backend, and an admin area for
training/retraining the disease-recognition model. Built from the
`ZhasylDala.dc.html` Claude Design mockup (Kazakh-language UI, teal
agro-minimalist style). See `/root/.claude/plans/dapper-crafting-candle.md`
in the session that built this for the full architecture writeup.

## ⚠️ Important: this was written, not run

The sandbox this was built in has no network access to PyPI, npm, or even
`apt` — `pip install` / `npm install` all fail there. Every file here was
written by hand and passed a static syntax check (`python -m py_compile`
for the backend, a TypeScript-compiler syntax pass for the frontend), but
**nothing has actually been run**: no `manage.py migrate`, no `npm run
build`, no live request against the API. Treat this as a complete,
carefully-written first draft that needs a normal "install deps, run it,
fix what breaks" pass in an environment with internet access — expect the
occasional typo or import-order issue, not architectural problems.

## Layout

```
backend/    Django + DRF API, admin, Celery tasks, ML inference/training
frontend/   React (Vite) SPA — the mobile-frame UI
docker-compose.yml   Postgres + Redis + web + worker + frontend (nginx)
```

## Hosting it on the internet with your own domain

See `DEPLOY.md` for a full step-by-step (in Russian) for deploying to
Railway with a custom domain, from "no GitHub repo yet" to a live site —
covers `Dockerfile.railway`/`railway.json` (already in this repo), the
Postgres plugin, environment variables, a persistent volume for uploaded
photos and the trained model, DNS/domain setup, and running
`bootstrap_plantvillage` on the server after the first deploy.

## Quickest path: Docker Compose

```
cp backend/.env.example backend/.env   # optional, defaults work
docker compose up --build
```

This builds and starts everything, runs migrations, seeds crops/diseases/
tips from the mockup's content, and serves the frontend on
`http://localhost` (API behind `/api/`, the app's own admin/training page
at `/admin`, Django's built-in admin at `/django-admin/`). The `worker`
service installs `requirements-ml.txt` (torch/torchvision/opencv) too, so
it's a slow first build — that's expected.

Create a staff account for the admin/training area:

```
docker compose exec web python manage.py createsuperuser
```

## Local dev (no Docker)

Backend:

```
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt          # add -r requirements-ml.txt for real inference
cp .env.example .env
python manage.py migrate
python manage.py seed_data
python manage.py createsuperuser
python manage.py runserver
```

Without `requirements-ml.txt` installed, the app still runs end-to-end —
every diagnosis just comes back as the neutral "model not trained yet"
fallback (see `apps/ml/services.py`). Without Redis running, Celery tasks
execute inline (`CELERY_TASK_ALWAYS_EAGER` defaults to `DEBUG`), so uploads
still resolve synchronously in dev.

Frontend:

```
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`, proxying `/api` and `/media` to
`http://localhost:8000` (see `vite.config.js`).

## Running tests

```
cd backend
python manage.py test
```

Covers registration+greenhouse creation, sector-grid labeling/QR
uniqueness, the anonymous diagnose pipeline end-to-end (including the
no-trained-model fallback path), and treatment-plan generation being
idempotent (a farmer revisiting the plan screen must never silently wipe
their checked-off items). Not exhaustive — the scan-walkthrough and
admin-training endpoints don't have tests yet.

## Training the disease model

### Fast path: one command, no manual uploads

```
cd backend
pip install -r requirements-ml.txt   # torch/torchvision — needed for the training step
python manage.py seed_data           # if you haven't already
python manage.py bootstrap_plantvillage
```

This downloads a small labeled sample (default 40 images/class) straight
from the public [PlantVillage dataset](https://github.com/spMohanty/PlantVillage-Dataset)
for every ZhasylDala crop that has a matching PlantVillage class:

| Crop | Classes downloaded |
|---|---|
| Қызанақ (tomato) | healthy, Фитофтороз (late blight), Өрмекші кене (spider mites) |
| Бұрыш (pepper) | healthy, Бактериялық дақ ауруы (bacterial spot) |
| Құлпынай (strawberry) | healthy, Жапырақ күйігі (leaf scorch) |

Saves them as verified `TrainingImage` rows, runs the same training loop
the admin page uses, and activates the resulting `ModelVersion`
automatically. Nothing is uploaded by hand; diagnosis works with a real
(if modest) model for all three crops right after it finishes. Needs
internet access to `github.com` / `raw.githubusercontent.com` — it's a
plain `requests` call, no git clone.

Useful flags:

```
python manage.py bootstrap_plantvillage --per-class 60   # more images/class (slower)
python manage.py bootstrap_plantvillage --no-train        # only download + label, train later
python manage.py bootstrap_plantvillage --no-activate      # train but don't switch prod over yet
```

**Not covered by PlantVillage — no free dataset for these:** Қияр
(cucumber), Баялды (eggplant), and Көкөніс көктері (greens) aren't in
PlantVillage at all (it only has 14 species total, mostly field/orchard
crops), and "Ақұнтақ" (мучнистая роса / powdery mildew) has no matching
tomato class either. Two ways to cover them:

1. Add real photos over time through the admin training page — works for
   literally any crop/disease, just slower to get started.
2. Set `KINDWISE_API_KEY` (see `.env.example`) to enable
   [Kindwise crop.health](https://www.kindwise.com/crop-health) as an
   automatic fallback (`apps/ml/kindwise.py`) — 23 crops, ~288
   diseases/pests, already wired into `apps/ml/services.py`. It's only
   ever called when the custom model has nothing for the requested crop
   (untrained, or a crop it was never trained on), so paid credits aren't
   spent on requests the free local model already answers. **No free
   tier** — from €50 for 1000 identifications
   ([pricing](https://www.kindwise.com/pricing)). Its disease names don't
   map onto the app's Kazakh knowledge base, so a Kindwise result shows
   the raw (English/Latin) label as plain text rather than full
   symptoms/recommendations — clearly marked as an external-API result.

Re-running `bootstrap_plantvillage` adds more seed images and trains a
fresh version each time; it's safe to run again later with a higher
`--per-class` for a better starting model.

### Manual path: the admin training page

1. `requirements-ml.txt` installed (torch/torchvision/opencv).
2. Get to 10+ **verified** `TrainingImage` rows — via the admin area at
   `/admin` (upload + label + "Растау"/verify — this is the *React*
   admin/training UI), the Django admin (`/django-admin/` —
   `django.contrib.admin`, a separate app on its own URL prefix so it
   never collides with the React `/admin` route), or `python manage.py
   seed_data` plus your own photos.
3. From the training area, click "Оқытуды бастау" (or `POST
   /api/admin/training-jobs/`). This runs `apps/ml/training.py` — a
   short CPU fine-tune of MobileNetV3-Small — and produces a `ModelVersion`
   in `ready` status.
4. Review its accuracy in the Models tab, then "Іске қосу" (activate) it.
   Production inference (`apps/ml/registry.py`) picks up the newly active
   version on its next call.

Both paths use the same underlying training loop and can be mixed freely —
run the bootstrap command for a cold start, then keep improving the model
through the admin page as real scans come in.

Pl@ntNet (`PLANTNET_API_KEY` in `.env`) is optional and only ever used as
a secondary species-confirmation signal, never the primary disease call —
see `apps/ml/plantnet.py` for why (Pl@ntNet identifies species, not
disease). Kindwise (`KINDWISE_API_KEY` in `.env`) is a separate optional,
paid fallback that *does* diagnose disease, for crops the custom model
has none — see `apps/ml/kindwise.py` and "Training the disease model"
above.

### The anonymous home-plant flow ("Үй өсімдігі")

This flow never collects a crop, so it can be photographing literally
anything — a tomato seedling, but just as easily a houseplant like an
orchid that's nothing like the 6 greenhouse crops above. Same custom
model, same rules: it only recognizes what it was actually trained on
(currently tomato/pepper/strawberry from `bootstrap_plantvillage`, plus
whatever's added via the admin page), and — since a low-confidence guess
is worse than an honest "not sure" — a photo of anything else now falls
through to a real fallback instead of confidently mislabeling it (see
`MIN_CONFIDENCE` in `apps/ml/services.py`).

For that fallback, Kindwise's **crop.health** (used for greenhouse crops)
isn't the right tool — it only covers ~23 food/field crops, no
ornamentals. Instead, set `KINDWISE_HEALTH_API_KEY` to enable
[Kindwise plant.health](https://www.kindwise.com/plant-health)
(`apps/ml/plant_health.py`) — a *separate* Kindwise product/signup built
for houseplants and ornamentals, returning a condition name plus
description/treatment text. Same cost model as crop.health: only called
when the custom model has nothing, no free tier
([pricing](https://www.kindwise.com/pricing)), and its result shows as
plain text (clearly marked as external) rather than a full Kazakh
knowledge-base entry, for the same reason as crop.health.

## What's real vs. simplified in this first pass

- Farmer registration is phone + password, no SMS verification — the
  mockup didn't show an OTP step either; add one before real deployment.
- Sector-video processing samples a single middle frame per clip
  (`apps/ml/video.py`) rather than analyzing the full 12 seconds — a
  reasonable place to invest more later (multi-frame voting, motion
  blur rejection, etc.).
- `python manage.py bootstrap_plantvillage` seeds and trains a cold-start
  model from a small PlantVillage sample automatically (see "Training the
  disease model" above), but it only covers the tomato/pepper/strawberry
  classes that have a clean PlantVillage match — other crops/diseases in
  the seeded
  knowledge base (e.g. Ақұнтақ, and every non-tomato crop) still need
  photos added through the admin training page before the model can
  recognize them.
- One greenhouse per farmer is assumed throughout the frontend
  (`Dashboard`/`Profile`/`ScanFlow` all take "the first greenhouse"); the
  backend already supports several per owner — multi-greenhouse UI (a
  switcher) is the natural next addition.
