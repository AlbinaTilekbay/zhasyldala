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
tomato class either. As long as `OPENAI_API_KEY` is set (see below), this
doesn't matter for real-world use — OpenAI vision handles any crop/plant
directly, with no dataset needed. `bootstrap_plantvillage` only matters
for the **offline fallback** the app uses when there's no internet or the
key isn't set; add real photos through the admin training page over time
to widen what that offline model covers too.

Re-running `bootstrap_plantvillage` adds more seed images and trains a
fresh version each time; it's safe to run again later with a higher
`--per-class` for a better offline-model baseline.

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
through the admin page as real scans come in. This offline model is now
the **fallback**, not the primary path — see the next section.

### Primary diagnosis engine: `OPENAI_API_KEY`

The main way ZhasylDala diagnoses a photo is by sending it directly to an
OpenAI vision-capable model (`apps/ml/openai_vision.py`), which both
recognizes the plant/condition **and** writes the result-screen cards in
one call — no separate species/disease dataset needed, no per-crop
coverage gaps. Set `OPENAI_API_KEY` (see `.env.example`) to enable it:

1. The photo is sent to `gpt-4o-mini` (OpenAI's cheapest vision-capable
   model) with a Kazakh, no-emoji prompt asking it to identify the
   species and condition, estimate severity/confidence, and write four
   clear sections: **Себебі** (cause), **Емдеу жолы** (treatment steps),
   **Алдын алу кеңестері** (prevention tips), and a short closing
   encouragement — rendered as their own cards on the result screen
   (`AiNarrative` in `frontend/src/components/ui.jsx`), used on both the
   home-plant result screen and a greenhouse sector's detail screen.
2. This is the **primary** path for both flows (`apps/ml/services.py:
   diagnose_image`) — tried first, before the offline model. It works for
   literally any plant/crop, not just the ones with training data, which
   is why `bootstrap_plantvillage`/Kindwise/Pl@ntNet-style per-crop
   dataset coverage no longer matters for online use.
3. It only falls through to the offline PlantVillage-trained model (see
   above) when `OPENAI_API_KEY` isn't set, there's no internet, or the
   call fails for some other reason — so the app still gives a real (if
   narrower) answer with zero internet connection, just without the
   OpenAI-written cards; failing that, a neutral "no answer yet" fallback.
4. This is billed OpenAI API usage, separate from a ChatGPT Plus
   subscription — create a key at
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
   Each diagnosis sends one photo plus a short prompt to `gpt-4o-mini`, so
   per-diagnosis cost is small — check OpenAI's current pricing page
   before relying on it for heavy use.

Kindwise (crop.health/plant.health) and Pl@ntNet were removed — OpenAI
vision now covers what they used to cover (and more, since it isn't
limited to ~23 crops or species-only identification), so there's no
longer a reason to pay for or configure either.

## What's real vs. simplified in this first pass

- Farmer registration is phone + password, no SMS verification — the
  mockup didn't show an OTP step either; add one before real deployment.
- A sector is diagnosed from a farmer-captured set of still photos
  (3–10, guided prompts for the first 3 — see `apps/scans/views.py`'s
  `sector_photos`/`finish_sector` and `apps/ml/openai_vision.py`'s
  multi-photo group analysis), not a video clip — an earlier version
  sampled one frame out of a 12s video, which produced unreliable
  material (motion blur, bad framing) for OpenAI vision to work with.
- `python manage.py bootstrap_plantvillage` seeds and trains a cold-start
  **offline fallback** model from a small PlantVillage sample
  automatically (see "Training the disease model" above), but it only
  covers the tomato/pepper/strawberry classes that have a clean
  PlantVillage match — other crops/diseases in the seeded knowledge base
  (e.g. Ақұнтақ, and every non-tomato crop) still need photos added
  through the admin training page before that offline model can recognize
  them. This doesn't affect normal (online) use, where OpenAI vision is
  the primary diagnosis engine and handles any crop/plant already.
- One greenhouse per farmer is assumed throughout the frontend
  (`Dashboard`/`Profile`/`ScanFlow` all take "the first greenhouse"); the
  backend already supports several per owner — multi-greenhouse UI (a
  switcher) is the natural next addition.
