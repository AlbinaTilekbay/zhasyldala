"""
Django settings for the ZhasylDala backend.

Configuration is environment-driven (see ../.env.example). Sensible local
defaults (sqlite, no redis) let `manage.py runserver` work with zero setup;
docker-compose / production supply Postgres + Redis via env vars.
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-secret-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    # first party
    "apps.core",
    "apps.accounts",
    "apps.greenhouses",
    "apps.scans",
    "apps.diagnosis",
    "apps.plans",
    "apps.tips",
    "apps.ml",
    "apps.ml_training",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# Three ways this gets configured, checked in order:
#  1. DATABASE_URL — a single connection string, e.g. Railway's Postgres
#     plugin (and Render/Heroku/most PaaS) inject this automatically.
#  2. POSTGRES_DB / POSTGRES_USER / ... — separate vars, what
#     docker-compose.yml sets for the local multi-container setup.
#  3. Neither set — sqlite file, for zero-setup local dev.
if os.environ.get("DATABASE_URL"):
    import dj_database_url

    DATABASES = {
        "default": dj_database_url.parse(os.environ["DATABASE_URL"], conn_max_age=600)
    }
elif os.environ.get("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "zhasyldala"),
            "USER": os.environ.get("POSTGRES_USER", "zhasyldala"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "zhasyldala"),
            "HOST": os.environ.get("POSTGRES_HOST", "db"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "kk"
TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE", "Asia/Almaty")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    # Setting STORAGES at all replaces Django's built-in default wholesale —
    # it does not merge with it — so leaving "default" out here (as this was
    # until now) meant every ImageField/FileField save (leaf photos, scan
    # videos, admin dataset uploads, bootstrap_plantvillage's downloads)
    # raised KeyError: 'default' the moment it tried to write a file. This
    # is what silently broke the anonymous home-plant diagnosis earlier too.
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Single-service deploys (see Dockerfile.railway) copy the built React app
# into backend/frontend_dist/ at image build time. When that folder exists,
# WhiteNoise serves its files (index.html, /assets/*.js, manifest, icons)
# straight from the site root — no separate frontend host needed. Locally
# this stays unset/missing and nothing changes (dev uses `npm run dev`).
_FRONTEND_DIST = BASE_DIR / "frontend_dist"
if _FRONTEND_DIST.exists():
    WHITENOISE_ROOT = _FRONTEND_DIST

MEDIA_URL = "/media/"
# The leading slash above matters a lot more than it looks: DRF's
# ImageField.to_representation() builds the URL the frontend receives as
# request.build_absolute_uri(value.url). When MEDIA_URL has no leading
# slash, value.url comes back as a *document-relative* path like
# "media/leaf.jpg", and build_absolute_uri() resolves a relative path
# against the current request's own URL, not the site root — so a POST to
# /api/diagnose/anonymous/ produced photo URLs like
# ".../api/diagnose/anonymous/media/leaf.jpg" (a 404) instead of
# ".../media/leaf.jpg". That 404 is exactly what showed up as the broken
# image icon on the result screen — every other part of the media-serving
# setup (urls.py routing, MEDIA_ROOT, the STORAGES fix) was already
# correct, so it never showed up in those files. With a leading slash,
# value.url is root-relative ("/media/leaf.jpg") and build_absolute_uri()
# resolves it correctly regardless of which endpoint generated it.
#
# Mount a persistent volume here in production (e.g. a Railway Volume at
# /app/media) — otherwise uploaded photos and trained model weights are
# lost on every redeploy, since container filesystems are ephemeral.
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", BASE_DIR / "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# DRF / JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_PARSER_CLASSES": (
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
CORS_ALLOW_CREDENTIALS = True

# Needed for the Django admin login (session+CSRF) once it's served over
# your own https:// domain — e.g. CSRF_TRUSTED_ORIGINS=https://zhasyldala.kz
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "")

# Railway (and most PaaS) terminate TLS at their edge and forward plain
# HTTP to the container with this header set — without it Django thinks
# every request is insecure and redirect/cookie-secure logic misbehaves.
if env_bool("DJANGO_BEHIND_PROXY", not DEBUG):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
# In local dev without a Redis/worker running, tasks execute inline so the
# app still works end-to-end (see apps/ml/tasks.py for what that involves).
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", DEBUG)
CELERY_TASK_EAGER_PROPAGATES = True

# ---------------------------------------------------------------------------
# ZhasylDala-specific settings
# ---------------------------------------------------------------------------
# Primary diagnosis engine (see apps/ml/openai_vision.py): sends the photo
# straight to an OpenAI vision-capable model, which identifies the plant
# and its condition AND writes the result-screen cards (cause, treatment
# steps, prevention tips, encouragement) in one call. No-ops until set —
# apps/ml/services.py then falls back to the offline PlantVillage-trained
# model (works with no internet at all, just narrower: currently only
# tomato/pepper/strawberry). Get a key (separate from a ChatGPT Plus
# subscription — this is billed API usage) at
# https://platform.openai.com/api-keys.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Directory (inside MEDIA_ROOT) where trained model weights are stored.
ML_MODELS_DIR = MEDIA_ROOT / "model_versions"
# Number of frames sampled from an uploaded sector video for inference.
ML_VIDEO_SAMPLE_FRAMES = int(os.environ.get("ML_VIDEO_SAMPLE_FRAMES", "5"))
